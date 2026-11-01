import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const configurationApi = vi.hoisted(() => ({
  dismissAiSetup: vi.fn(),
  fetchAiConfiguration: vi.fn(),
  removeAiKey: vi.fn(),
  saveAndTestAiConfiguration: vi.fn(),
}));

vi.mock("./aiConfigurationClient", () => configurationApi);

import {
  AiConfigurationPanel,
  AiFirstLaunchPrompt,
} from "./AiConfigurationPanel";
import type { AiConfigurationStatus } from "./aiConfigurationClient";
import { AI_DISCLOSURES } from "./disclosures";

const EMPTY_STATUS = {
  hasKey: false,
  setupSkipped: false,
  activated: false,
  gateCode: null,
  gateReason: null,
  region: null,
  tier: null,
};

const SAVED_STATUS = {
  ...EMPTY_STATUS,
  hasKey: true,
  region: "non-eea-uk-ch" as const,
  tier: "free" as const,
};

async function completeSetupFields(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText("Region"), "non-eea-uk-ch");
  await user.selectOptions(screen.getByLabelText("Google project tier"), "free");
  await user.click(screen.getByLabelText(/I am at least 18 years old/));
  await user.click(screen.getByLabelText(/I checked this project's current limits/));
  await user.click(screen.getByLabelText(/I have read and accept all M1–M8 disclosures/));
}

beforeEach(() => {
  vi.clearAllMocks();
  configurationApi.fetchAiConfiguration.mockResolvedValue(EMPTY_STATUS);
});

describe("optional Gemini setup", () => {
  it("keeps app navigation available and remembers Continue without AI", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    configurationApi.dismissAiSetup.mockResolvedValue({
      ...EMPTY_STATUS,
      setupSkipped: true,
    });

    render(
      <>
        <button onClick={onNavigate} type="button">Navigate</button>
        <AiFirstLaunchPrompt />
      </>,
    );

    expect(await screen.findByText("Set up optional Gemini AI?")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Navigate" }));
    expect(onNavigate).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Continue without AI" }));

    expect(configurationApi.dismissAiSetup).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.queryByText("Set up optional Gemini AI?")).not.toBeInTheDocument(),
    );
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("shows all frozen disclosures and sends setup only after explicit submission", async () => {
    const user = userEvent.setup();
    configurationApi.saveAndTestAiConfiguration.mockResolvedValue({
      ok: true,
      configuration: { ...SAVED_STATUS, activated: true },
      models: ["gemini-3.5-flash-lite", "gemini-3.8-flash"],
    });

    render(<AiConfigurationPanel firstLaunch />);

    for (const disclosure of AI_DISCLOSURES) {
      expect(await screen.findByText(disclosure.text)).toBeInTheDocument();
    }
    expect(configurationApi.saveAndTestAiConfiguration).not.toHaveBeenCalled();

    await user.type(
      screen.getByLabelText("Gemini API key"),
      "test-gemini-secret-key-value-123456",
    );
    await user.selectOptions(screen.getByLabelText("Region"), "non-eea-uk-ch");
    await user.selectOptions(screen.getByLabelText("Google project tier"), "free");
    await user.click(
      screen.getByLabelText(/I am at least 18 years old/),
    );
    await user.click(
      screen.getByLabelText(/I checked this project's current limits/),
    );
    await user.click(
      screen.getByLabelText(/I have read and accept all M1–M8 disclosures/),
    );
    await user.click(
      screen.getByRole("button", { name: "Save key and test connection" }),
    );

    await waitFor(() =>
      expect(configurationApi.saveAndTestAiConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "test-gemini-secret-key-value-123456",
          region: "non-eea-uk-ch",
          tier: "free",
          ageConfirmed: true,
          limitsConfirmed: true,
          exposureAcknowledged: true,
        }),
      ),
    );
    expect(screen.getByLabelText("Replace Gemini API key (leave blank to keep current key)")).toHaveValue("");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("allows replacing and removing a key from Settings", async () => {
    const user = userEvent.setup();
    configurationApi.fetchAiConfiguration.mockResolvedValue({
      ...SAVED_STATUS,
      activated: true,
    });
    configurationApi.saveAndTestAiConfiguration.mockResolvedValue({
      ok: true,
      configuration: { ...SAVED_STATUS, activated: true },
      models: ["gemini-3.5-flash-lite", "gemini-3.8-flash"],
    });
    configurationApi.removeAiKey.mockResolvedValue({
      ...EMPTY_STATUS,
      setupSkipped: true,
    });

    render(<AiConfigurationPanel />);

    const keyInput = await screen.findByLabelText(
      "Replace Gemini API key (leave blank to keep current key)",
    );
    await user.type(keyInput, "replacement-gemini-key-value-123456");
    await user.selectOptions(screen.getByLabelText("Region"), "non-eea-uk-ch");
    await user.selectOptions(screen.getByLabelText("Google project tier"), "free");
    await user.click(
      screen.getByLabelText(/I am at least 18 years old/),
    );
    await user.click(
      screen.getByLabelText(/I checked this project's current limits/),
    );
    await user.click(
      screen.getByLabelText(/I have read and accept all M1–M8 disclosures/),
    );
    await user.click(
      screen.getByRole("button", { name: "Save key and test connection" }),
    );

    await waitFor(() =>
      expect(configurationApi.saveAndTestAiConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "replacement-gemini-key-value-123456",
        }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Remove saved key" }));
    expect(configurationApi.removeAiKey).toHaveBeenCalledOnce();
  });

  it("shows saving/testing progress, retains a saved key after connection failure, and re-enables the button", async () => {
    const user = userEvent.setup();
    let finishRequest!: (result: {
      ok: boolean;
      configuration: AiConfigurationStatus;
      message: string;
    }) => void;
    configurationApi.saveAndTestAiConfiguration.mockImplementation(
      () => new Promise((resolve) => {
        finishRequest = resolve;
      }),
    );

    render(<AiConfigurationPanel />);
    await screen.findByText("No Gemini key is saved on this computer.");
    const keyInput = screen.getByLabelText("Gemini API key");
    await user.type(keyInput, "test-gemini-secret-key-value-123456");
    await completeSetupFields(user);
    await user.click(screen.getByRole("button", { name: "Save key and test connection" }));

    expect(await screen.findByText(/Saving the key securely.*checking Gemini model access/)).toBeInTheDocument();
    const busyButton = screen.getByRole("button", {
      name: "Saving key and testing connection…",
    });
    expect(busyButton).toBeDisabled();

    finishRequest({
      ok: false,
      configuration: {
        ...SAVED_STATUS,
        gateCode: "model_not_confirmed",
        gateReason: "model_not_confirmed",
      },
      message:
        "The key was saved, but the connection test failed. The project's Gemini quota or rate limit was reached.",
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The key was saved, but the connection test failed.",
    );
    expect(screen.getByText("Gemini is saved but not ready: model_not_confirmed")).toBeInTheDocument();
    expect(screen.getByLabelText("Replace Gemini API key (leave blank to keep current key)")).toHaveValue("");
    const retryButton = screen.getByRole("button", { name: "Save key and test connection" });
    expect(retryButton).toBeEnabled();
  });

  it("keeps the entered key and makes the button usable after a local network failure", async () => {
    const user = userEvent.setup();
    configurationApi.saveAndTestAiConfiguration.mockRejectedValue(
      new Error("local request failed"),
    );

    render(<AiConfigurationPanel />);
    await screen.findByText("No Gemini key is saved on this computer.");
    const keyInput = screen.getByLabelText("Gemini API key");
    await user.type(keyInput, "test-gemini-secret-key-value-123456");
    await completeSetupFields(user);
    await user.click(screen.getByRole("button", { name: "Save key and test connection" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not confirm that the key was saved and tested",
    );
    expect(screen.getByLabelText("Gemini API key")).toHaveValue(
      "test-gemini-secret-key-value-123456",
    );
    expect(screen.getByRole("button", { name: "Save key and test connection" })).toBeEnabled();
  });

  it("rejects an empty key locally before sending a configuration request", async () => {
    const user = userEvent.setup();
    render(<AiConfigurationPanel />);
    await screen.findByText("No Gemini key is saved on this computer.");
    await completeSetupFields(user);
    await user.click(screen.getByRole("button", { name: "Save key and test connection" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a Gemini API key");
    expect(configurationApi.saveAndTestAiConfiguration).not.toHaveBeenCalled();
  });

  it("reports when first-launch setup cannot load instead of silently hiding it", async () => {
    configurationApi.fetchAiConfiguration.mockRejectedValue(
      new Error("local server unavailable"),
    );

    render(<AiFirstLaunchPrompt />);

    expect(
      await screen.findByText(/Optional Gemini setup is unavailable/),
    ).toBeInTheDocument();
  });
});
