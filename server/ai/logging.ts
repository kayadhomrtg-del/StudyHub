/**
 * The structured request log.
 *
 * One JSON line per request, written to stdout. The line carries only the
 * agreed fields: never a request or response body, never a header value, and
 * never key material.
 */

import type { AiErrorCode, AiGateVerdictLabel } from "./types";

export interface AiRequestLogEntry {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  bytesIn: number;
  bytesOut: number;
  model: string | null;
  upstreamStatus: number | null;
  upstreamAttempted: boolean;
  errorCode: AiErrorCode | null;
  gateVerdict: AiGateVerdictLabel;
}

export interface AiLogStream {
  write(chunk: string): unknown;
}

/** Writes a single log line. */
export function writeAiRequestLog(
  stream: AiLogStream,
  entry: AiRequestLogEntry,
): void {
  stream.write(`${JSON.stringify(entry)}\n`);
}
