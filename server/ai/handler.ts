/**
 * The HTTP surface of the AI proxy.
 *
 * The routes are always mounted, but they answer with `not_configured` unless
 * `STUDY_HUB_AI_ENABLED=1`. The order of the checks is fixed:
 *
 * route and method -> loopback Host -> Origin -> enabled -> pipeline.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import {
  disabledActivationReader,
  type AiActivationReader,
} from "./activation";
import { AiBudget, nextLocalDayReset, resolveUsageFilePath } from "./budget";
import {
  AI_ENABLED_ENV_VAR,
  AI_FEATURE_CONFIGS,
  AI_MAX_REQUEST_BYTES,
  isAiEnabled,
  type AiFeature,
  type AiFeatureConfig,
} from "./config";
import {
  evaluateGates,
  readGateArtifact,
  resolveGateArtifactPath,
  type AiGateVerdict,
} from "./gates";
import {
  writeAiRequestLog,
  type AiLogStream,
  type AiRequestLogEntry,
} from "./logging";
import { AiPayloadStore } from "./payloadStore";
import {
  runPreparePipeline,
  runSendPipeline,
  type AiPipelineDependencies,
} from "./pipeline";
import { unconfiguredProvider, type AiProvider } from "./provider";
import {
  readRequestBody,
  validateHostHeader,
  validateOriginHeader,
} from "./requestValidation";
import {
  AI_ERROR_STATUS,
  AI_PREPARE_ROUTE,
  AI_ROUTE_PREFIX,
  AI_SEND_ROUTE,
  AI_STATUS_ROUTE,
  type AiErrorBody,
  type AiErrorCode,
  type AiGateVerdictLabel,
} from "./types";

export interface AiHandlerOptions {
  /** Project root; the launch artifact and usage counter live beneath it. */
  root: string;
  provider?: AiProvider;
  activation?: AiActivationReader;
  budget?: AiBudget;
  payloadStore?: AiPayloadStore;
  gateArtifactPath?: string;
  usageFilePath?: string;
  featureConfigs?: Record<AiFeature, AiFeatureConfig>;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
  logStream?: AiLogStream;
  /** The port this server is listening on, when it is known. */
  serverPort?: () => number | null;
}

interface RouteDefinition {
  method: "GET" | "POST";
  path: string;
}

const ROUTES: readonly RouteDefinition[] = [
  { method: "GET", path: AI_STATUS_ROUTE },
  { method: "POST", path: AI_PREPARE_ROUTE },
  { method: "POST", path: AI_SEND_ROUTE },
];

function sendJson(res: ServerResponse, status: number, body: unknown): number {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(text);
  return Buffer.byteLength(text, "utf8");
}

/**
 * Creates the AI request handler.
 *
 * The default dependencies are the production ones: the unconfigured
 * provider and the permanently disabled activation reader. Tests may inject
 * their own, but the mounted production route never uses a fake provider.
 */
export function createAiHandler(
  options: AiHandlerOptions,
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  const now = options.now ?? (() => new Date());
  const env = options.env ?? process.env;
  const logStream = options.logStream ?? process.stdout;
  const provider = options.provider ?? unconfiguredProvider;
  const activation = options.activation ?? disabledActivationReader;
  const payloadStore = options.payloadStore ?? new AiPayloadStore();
  const gateArtifactPath =
    options.gateArtifactPath ?? resolveGateArtifactPath(options.root);
  const usageFilePath =
    options.usageFilePath ?? resolveUsageFilePath(options.root);
  const budget = options.budget ?? new AiBudget(usageFilePath, now);
  const featureConfigs = options.featureConfigs ?? AI_FEATURE_CONFIGS;
  const serverPort = options.serverPort ?? (() => null);

  const deps: AiPipelineDependencies = {
    provider,
    activation,
    budget,
    payloadStore,
    gateArtifactPath,
    now,
    featureConfigs,
  };

  return function aiRequestHandler(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): void {
    const path = (req.url ?? "/").split("?")[0] ?? "/";

    if (path !== AI_ROUTE_PREFIX && !path.startsWith(`${AI_ROUTE_PREFIX}/`)) {
      next();
      return;
    }

    void handleAiRequest({
      req,
      res,
      path,
      method: req.method ?? "GET",
      deps,
      env,
      logStream,
      serverPort,
      now,
    }).catch(() => {
      if (!res.headersSent) {
        sendJson(res, 500, {
          ok: false,
          error: {
            code: "invalid_request",
            message: "The AI proxy could not handle the request.",
            upstreamAttempted: false,
          },
        } satisfies AiErrorBody);
      }
    });
  };
}

interface HandleContext {
  req: IncomingMessage;
  res: ServerResponse;
  path: string;
  method: string;
  deps: AiPipelineDependencies;
  env: NodeJS.ProcessEnv;
  logStream: AiLogStream;
  serverPort: () => number | null;
  now: () => Date;
}

async function handleAiRequest(context: HandleContext): Promise<void> {
  const startedAt = Date.now();
  const { req, res, path, method } = context;

  let bytesIn = 0;
  let bytesOut = 0;
  let model: string | null = null;
  let upstreamStatus: number | null = null;
  let upstreamAttempted = false;
  let errorCode: AiErrorCode | null = null;
  let gateVerdict: AiGateVerdictLabel = "not_evaluated";

  const respond = (status: number, body: unknown): void => {
    bytesOut = sendJson(res, status, body);
  };

  const respondError = (
    code: AiErrorCode,
    message: string,
    attempted = false,
    extra?: { outputText?: string; status?: number },
  ): void => {
    errorCode = code;
    upstreamAttempted = attempted;
    const body: AiErrorBody = {
      ok: false,
      error: { code, message, upstreamAttempted: attempted },
      ...(extra?.outputText === undefined ? {} : { outputText: extra.outputText }),
    };
    respond(extra?.status ?? AI_ERROR_STATUS[code], body);
  };

  const log = (): void => {
    const entry: AiRequestLogEntry = {
      method,
      path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      bytesIn,
      bytesOut,
      model,
      upstreamStatus,
      upstreamAttempted,
      errorCode,
      gateVerdict,
    };
    writeAiRequestLog(context.logStream, entry);
  };

  const route = ROUTES.find((candidate) => candidate.path === path);
  if (!route) {
    respondError("invalid_request", "Unknown AI route.", false, { status: 404 });
    log();
    return;
  }

  if (route.method !== method) {
    respondError(
      "invalid_request",
      `The ${path} route only accepts ${route.method} requests.`,
      false,
      { status: 405 },
    );
    log();
    return;
  }

  const expectedPort = context.serverPort();
  const host = validateHostHeader(req.headers.host, expectedPort);
  if (!host.ok) {
    respondError("forbidden_origin", host.reason);
    log();
    return;
  }

  const origin = validateOriginHeader(
    req.headers.origin,
    expectedPort,
    route.method === "POST",
  );
  if (!origin.ok) {
    respondError("forbidden_origin", origin.reason);
    log();
    return;
  }

  if (!isAiEnabled(context.env)) {
    gateVerdict = "disabled";
    respondError(
      "not_configured",
      `The AI proxy is disabled. Set ${AI_ENABLED_ENV_VAR}=1 to enable it.`,
    );
    log();
    return;
  }

  if (route.path === AI_STATUS_ROUTE) {
    gateVerdict = await respondWithStatus(context, respond);
    log();
    return;
  }

  const body = await readRequestBody(req, AI_MAX_REQUEST_BYTES);
  bytesIn = body.bytes;

  if (route.path === AI_PREPARE_ROUTE) {
    const prepared = await runPreparePipeline(context.deps, body);
    if (!prepared.ok) {
      gateVerdict = prepared.gateBlocked ? "blocked" : "pass";
      respondError(prepared.code, prepared.message);
      log();
      return;
    }

    gateVerdict = "pass";
    model = prepared.value.payload.model;
    respond(200, {
      ok: true,
      token: prepared.value.token,
      digest: prepared.value.digest,
      expiresAt: prepared.value.expiresAt,
      payload: prepared.value.payload,
      payloadText: prepared.value.payloadText,
      payloadBytes: prepared.value.payloadBytes,
    });
    log();
    return;
  }

  const sent = await runSendPipeline(context.deps, body);
  if (!sent.ok) {
    upstreamStatus = sent.upstreamStatus;
    upstreamAttempted = sent.upstreamAttempted;
    gateVerdict = sent.gateBlocked ? "blocked" : "pass";
    respondError(sent.code, sent.message, sent.upstreamAttempted, {
      outputText: sent.outputText,
    });
    log();
    return;
  }

  gateVerdict = "pass";
  model = sent.value.model;
  upstreamStatus = sent.value.upstreamStatus;
  respond(200, {
    ok: true,
    status: sent.value.status,
    model: sent.value.model,
    outputText: sent.value.outputText,
  });
  log();
}

async function respondWithStatus(
  context: HandleContext,
  respond: (status: number, body: unknown) => void,
): Promise<AiGateVerdictLabel> {
  const { deps, now } = context;

  const read = await readGateArtifact(deps.gateArtifactPath);
  const verdict: AiGateVerdict =
    read.status === "ok"
      ? evaluateGates(read.artifact, now())
      : {
          ok: false,
          code: read.status === "missing" ? "gates_not_recorded" : "gates_invalid",
          reason: read.reason,
        };

  const activation = await deps.activation.read();
  const cap = read.status === "ok" ? read.artifact.effectiveDailyCap : null;
  const budget = await deps.budget.read(cap ?? 0);
  const reset = nextLocalDayReset(now());

  respond(200, {
    ok: true,
    enabled: true,
    phase: 1,
    provider: deps.provider.name,
    providerConfigured: deps.provider.configured,
    dispatchPossible:
      verdict.ok && activation.activated && deps.provider.configured,
    gates: {
      verdict: verdict.ok ? "pass" : "blocked",
      code: verdict.ok ? null : verdict.code,
      reason: verdict.ok ? null : verdict.reason,
    },
    budget: {
      status: budget.status,
      used: budget.status === "ok" ? budget.used : null,
      cap,
      remaining: budget.status === "ok" ? budget.remaining : null,
      windowStart: budget.status === "ok" ? budget.windowStart : null,
      nextResetAt: reset.toISOString(),
      reason: budget.status === "ok" ? null : budget.reason,
    },
  });

  return verdict.ok ? "pass" : "blocked";
}
