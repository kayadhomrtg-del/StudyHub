import type { AiConfigurationService } from "./configuration";
import type { AiSecretStore } from "./secretStore";
export interface AiActivationState {
  activated: boolean;
  reason: string;
}

export interface AiActivationReader {
  read(): AiActivationState | Promise<AiActivationState>;
}

export const disabledActivationReader: AiActivationReader = {
  read(): AiActivationState {
    return {
      activated: false,
      reason: "AI dispatch has not been explicitly activated.",
    };
  },
};

export class LocalActivationReader implements AiActivationReader {
  constructor(
    private readonly configuration: AiConfigurationService,
    private readonly secretStore: AiSecretStore,
  ) {}

  async read(): Promise<AiActivationState> {
    const state = await this.configuration.readRuntimeState();
    if (!state.activated) {
      return {
        activated: false,
        reason: "Configure and test Gemini in Settings to enable dispatch.",
      };
    }

    try {
      await this.secretStore.read();
    } catch {
      return {
        activated: false,
        reason: "The saved Gemini key is unavailable or invalid.",
      };
    }

    return {
      activated: true,
      reason: "Gemini was activated after a successful connection test.",
    };
  }
}
