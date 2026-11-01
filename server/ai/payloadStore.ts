/**
 * The server-side prepared-payload store.
 *
 * The approval handshake is `prepare` then `send`:
 *
 * 1. `prepare` validates the request, stores the canonical payload on the
 *    server, and returns the exact payload together with a single-use token.
 * 2. The user reviews the exact payload and approves it.
 * 3. `send` presents the token, the server checks the digest, consumes the
 *    token, and dispatches exactly the stored payload.
 *
 * The digest is an integrity check only. It is never proof that a human
 * approved anything, never proof of authorization, and never evidence of
 * provider eligibility.
 */

import { createHash, randomBytes } from "node:crypto";

import { AI_PAYLOAD_TTL_MS } from "./config";
import type { AiErrorCode, AiProviderPayload } from "./types";

export interface AiPreparedPayload {
  payload: AiProviderPayload;
  /** The exact serialised bytes that would be sent upstream. */
  payloadText: string;
  digest: string;
  createdAt: number;
  expiresAt: number;
}

export interface AiPreparedPayloadResult {
  token: string;
  digest: string;
  expiresAt: string;
  payload: AiProviderPayload;
  payloadText: string;
  payloadBytes: number;
}

export type AiTokenLookup =
  | { ok: true; entry: AiPreparedPayload }
  | { ok: false; code: AiErrorCode; message: string };

/** Computes the integrity digest of a payload. */
export function computePayloadDigest(payloadText: string): string {
  return `sha256:${createHash("sha256").update(payloadText, "utf8").digest("hex")}`;
}

export class AiPayloadStore {
  private readonly entries = new Map<string, AiPreparedPayload>();

  constructor(
    private readonly ttlMs: number = AI_PAYLOAD_TTL_MS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Stores a payload and returns the single-use token that authorises it. */
  create(payload: AiProviderPayload): AiPreparedPayloadResult {
    this.pruneExpired();

    const payloadText = JSON.stringify(payload);
    const digest = computePayloadDigest(payloadText);
    const createdAt = this.now();
    const expiresAt = createdAt + this.ttlMs;
    const token = randomBytes(32).toString("hex");

    this.entries.set(token, { payload, payloadText, digest, createdAt, expiresAt });

    return {
      token,
      digest,
      expiresAt: new Date(expiresAt).toISOString(),
      payload,
      payloadText,
      payloadBytes: Buffer.byteLength(payloadText, "utf8"),
    };
  }

  /**
   * Looks up a token and checks the digest. The token is consumed only when
   * the lookup succeeds, so a rejected digest cannot silently burn an
   * otherwise valid approval.
   */
  consume(token: string | null, digest: string | null): AiTokenLookup {
    this.pruneExpired();

    if (!token) {
      return {
        ok: false,
        code: "not_approved",
        message: "No approval token was supplied.",
      };
    }

    const entry = this.entries.get(token);
    if (!entry) {
      return {
        ok: false,
        code: "not_approved",
        message: "The approval token is unknown, has expired, or has already been used.",
      };
    }

    if (!digest) {
      return {
        ok: false,
        code: "integrity_mismatch",
        message: "No payload digest was supplied.",
      };
    }

    if (digest !== entry.digest) {
      return {
        ok: false,
        code: "integrity_mismatch",
        message:
          "The payload digest does not match the prepared payload, so nothing was sent.",
      };
    }

    this.entries.delete(token);
    return { ok: true, entry };
  }

  /** Number of prepared payloads that are still usable. */
  get size(): number {
    this.pruneExpired();
    return this.entries.size;
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [token, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(token);
      }
    }
  }
}
