/**
 * The local request budget.
 *
 * The counter is local and server-enforced. Its window is the machine's local
 * calendar day, which is deliberately *not* implied to match Google's
 * midnight-Pacific requests-per-day reset.
 *
 * Fail-closed rule: a usage state that is missing, malformed, unreadable, or
 * otherwise corrupted is never silently reset to zero. Such a state refuses
 * further dispatches with the deterministic `local_limit` code.
 */

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { AI_LOCAL_STATE_DIRECTORY, AI_USAGE_FILENAME } from "./config";

export interface AiUsageState {
  schemaVersion: 1;
  /** Local calendar day, `YYYY-MM-DD`. */
  windowStart: string;
  used: number;
  updatedAt: string;
}

export type AiBudgetStatus =
  | "ok"
  | "missing"
  | "malformed"
  | "unreadable"
  | "clock";

export type AiBudgetRead =
  | {
      status: "ok";
      windowStart: string;
      used: number;
      cap: number;
      remaining: number;
    }
  | {
      status: Exclude<AiBudgetStatus, "ok">;
      reason: string;
      cap: number;
    };

export type AiBudgetCharge =
  | { ok: true; used: number; windowStart: string }
  | { ok: false; code: "local_limit"; reason: string };

/** Formats a date as the machine's local calendar day. */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The moment the local counter window rolls over. This is the machine's local
 * midnight and is deliberately not implied to match the provider's
 * midnight-Pacific requests-per-day reset.
 */
export function nextLocalDayReset(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
    0,
    0,
    0,
    0,
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLocalDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

/** Resolves the usage counter path for a project root. */
export function resolveUsageFilePath(root: string): string {
  return resolve(root, AI_LOCAL_STATE_DIRECTORY, AI_USAGE_FILENAME);
}

export class AiBudget {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Initializes a fresh counter without replacing any existing state. */
  async initialize(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const initial: AiUsageState = {
      schemaVersion: 1,
      windowStart: localDateKey(this.now()),
      used: 0,
      updatedAt: this.now().toISOString(),
    };
    try {
      await writeFile(this.filePath, JSON.stringify(initial), { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return;
      throw new Error("The local AI usage counter could not be initialized.");
    }
  }

  /**
   * Reads the current usage state. The returned `status` decides whether a
   * dispatch may proceed: only `ok` allows it.
   */
  async read(cap: number): Promise<AiBudgetRead> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return {
          status: "missing",
          cap,
          reason:
            `No local usage counter was found at ${this.filePath}. ` +
            `Create it with {"schemaVersion":1,"windowStart":"${localDateKey(this.now())}","used":0} ` +
            "before using the AI proxy. The counter is never reset silently, because that would grant extra capacity.",
        };
      }
      return {
        status: "unreadable",
        cap,
        reason:
          `The local usage counter at ${this.filePath} could not be read (${code ?? "unknown error"}).`,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        status: "malformed",
        cap,
        reason: `The local usage counter at ${this.filePath} is not valid JSON.`,
      };
    }

    if (!isPlainObject(parsed)) {
      return {
        status: "malformed",
        cap,
        reason: `The local usage counter at ${this.filePath} is not a JSON object.`,
      };
    }

    if (parsed.schemaVersion !== 1) {
      return {
        status: "malformed",
        cap,
        reason: `The local usage counter at ${this.filePath} has an unsupported schemaVersion.`,
      };
    }

    if (!isLocalDateKey(parsed.windowStart)) {
      return {
        status: "malformed",
        cap,
        reason: `The local usage counter at ${this.filePath} has an invalid windowStart.`,
      };
    }

    if (
      typeof parsed.used !== "number" ||
      !Number.isInteger(parsed.used) ||
      parsed.used < 0
    ) {
      return {
        status: "malformed",
        cap,
        reason: `The local usage counter at ${this.filePath} has an invalid used count.`,
      };
    }

    const today = localDateKey(this.now());

    if (parsed.windowStart > today) {
      return {
        status: "clock",
        cap,
        reason:
          `The local usage counter at ${this.filePath} starts on ${parsed.windowStart}, which is in the future.`,
      };
    }

    if (parsed.windowStart < today) {
      // A new local calendar day. This is the only path that starts a fresh
      // count, and it is the documented daily reset rather than a silent
      // recovery from a broken counter.
      return { status: "ok", windowStart: today, used: 0, cap, remaining: cap };
    }

    const used = parsed.used;
    return {
      status: "ok",
      windowStart: parsed.windowStart,
      used,
      cap,
      remaining: Math.max(0, cap - used),
    };
  }

  /**
   * Charges exactly one unit. The charge happens before the provider call, so
   * a dispatched request that fails still consumes exactly one unit.
   */
  async charge(cap: number): Promise<AiBudgetCharge> {
    const run = this.queue.then(
      () => this.chargeOnce(cap),
      () => this.chargeOnce(cap),
    );
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async chargeOnce(cap: number): Promise<AiBudgetCharge> {
    const state = await this.read(cap);

    if (state.status !== "ok") {
      return { ok: false, code: "local_limit", reason: state.reason };
    }

    if (state.remaining <= 0) {
      return {
        ok: false,
        code: "local_limit",
        reason: `The local daily cap of ${cap} request(s) has been reached for ${state.windowStart}.`,
      };
    }

    const used = state.used + 1;
    const next: AiUsageState = {
      schemaVersion: 1,
      windowStart: state.windowStart,
      used,
      updatedAt: this.now().toISOString(),
    };

    try {
      await this.writeState(next);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      return {
        ok: false,
        code: "local_limit",
        reason:
          `The local usage counter at ${this.filePath} could not be updated (${code ?? "unknown error"}), ` +
          "so no request was sent.",
      };
    }

    return { ok: true, used, windowStart: state.windowStart };
  }

  private async writeState(state: AiUsageState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    try {
      await rename(temporary, this.filePath);
    } catch (error) {
      await rmQuietly(temporary);
      throw error;
    }
  }
}

async function rmQuietly(path: string): Promise<void> {
  try {
    await rm(path, { force: true });
  } catch {
    // The temporary file is best-effort cleanup only.
  }
}
