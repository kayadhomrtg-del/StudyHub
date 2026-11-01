/**
 * The runtime activation step.
 *
 * Activation is deliberately separate from the API key and from every
 * environment variable: setting a key or a flag is a preparation, never an
 * authorization. The mechanism that performs the activation is introduced in
 * a later phase, and only if provider eligibility is ever resolved.
 *
 * In Phase 1 the activation reader is permanently disabled, so the
 * conjunction of requirements in `docs/AI_PLAN.md` section 6.1 can never be
 * satisfied.
 */

export interface AiActivationState {
  activated: boolean;
  reason: string;
}

export interface AiActivationReader {
  read(): AiActivationState | Promise<AiActivationState>;
}

/**
 * The Phase 1 activation reader. It is disabled on purpose and must stay
 * disabled until a later phase replaces it with an explicit owner action.
 */
export const disabledActivationReader: AiActivationReader = {
  read(): AiActivationState {
    return {
      activated: false,
      reason:
        "The explicit runtime activation step is not implemented, so no request can be dispatched.",
    };
  },
};
