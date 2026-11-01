/**
 * Integrity checks shared by the payload preview and the send guard.
 *
 * The preview must show the exact bytes the proxy stored. These checks are
 * deliberately repeated in the browser: a mismatch is rejected before any
 * send, and the digest is still only an integrity value.
 */

import type { AiPreparedSummary } from "./aiTypes";

export type PayloadIntegrityResult =
  | { ok: true; bytes: number }
  | { ok: false; message: string };

export const PAYLOAD_INTEGRITY_VERIFIED =
  "Payload integrity verified: the preview text matches the prepared payload and byte count.";

export const PAYLOAD_INTEGRITY_FAILED =
  "Payload integrity check failed. This payload must not be approved or sent.";

export function validatePreparedPayload(
  prepared: Pick<AiPreparedSummary, "payload" | "payloadText" | "payloadBytes">,
  requestLabel = "summary",
): PayloadIntegrityResult {
  const serialized = JSON.stringify(prepared.payload);
  if (serialized !== prepared.payloadText) {
    return {
      ok: false,
      message:
        `The preview text does not match the prepared payload. No ${requestLabel} request was sent.`,
    };
  }

  const bytes = new TextEncoder().encode(prepared.payloadText).byteLength;
  if (bytes !== prepared.payloadBytes) {
    return {
      ok: false,
      message:
        `The preview byte count does not match the prepared payload. No ${requestLabel} request was sent.`,
    };
  }

  return { ok: true, bytes };
}
