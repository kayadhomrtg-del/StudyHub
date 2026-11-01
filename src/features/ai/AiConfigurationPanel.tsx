import { useEffect, useState, type FormEvent } from "react";
import { DisclosurePanel } from "./DisclosurePanel";
import {
  dismissAiSetup,
  fetchAiConfiguration,
  removeAiKey,
  saveAndTestAiConfiguration,
  type AiConfigurationInput,
  type AiConfigurationStatus,
  type AiConfiguredRegion,
  type AiConfiguredTier,
} from "./aiConfigurationClient";

const REGION_OPTIONS: { value: AiConfiguredRegion; label: string }[] = [
  {
    value: "non-eea-uk-ch",
    label: "Google-supported country outside the EEA, Switzerland, and UK",
  },
  { value: "eea", label: "European Economic Area" },
  { value: "switzerland", label: "Switzerland" },
  { value: "united-kingdom", label: "United Kingdom" },
];

interface AiConfigurationPanelProps {
  firstLaunch?: boolean;
  onDismiss?: () => void;
}

function statusMessage(status: AiConfigurationStatus): string {
  if (!status.hasKey) return "No Gemini key is saved on this computer.";
  if (status.activated) return "Gemini is configured and activated on this computer.";
  if (status.gateReason) return `Gemini is saved but not ready: ${status.gateReason}`;
  return "Gemini is saved but has not passed the connection check.";
}

export function AiConfigurationPanel({
  firstLaunch = false,
  onDismiss,
}: AiConfigurationPanelProps) {
  const [configuration, setConfiguration] = useState<AiConfigurationStatus>();
  const [key, setKey] = useState("");
  const [region, setRegion] = useState<AiConfiguredRegion | "">("");
  const [tier, setTier] = useState<AiConfiguredTier | "">("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [billingConfirmed, setBillingConfirmed] = useState(false);
  const [limitsConfirmed, setLimitsConfirmed] = useState(false);
  const [exposureAcknowledged, setExposureAcknowledged] = useState(false);
  const [dailyCap, setDailyCap] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetchAiConfiguration()
      .then((status) => {
        if (!active) return;
        setConfiguration(status);
        if (status.region) setRegion(status.region);
        if (status.tier) setTier(status.tier);
      })
      .catch(() => {
        if (active) setError("Local AI configuration is unavailable.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!region || !tier) {
      setError("Choose the region and Google project service tier first.");
      return;
    }
    if (!configuration?.hasKey && key.trim() === "") {
      setError("Enter a Gemini API key to configure AI.");
      return;
    }
    setBusy(true);
    const submittedKey = key;
    try {
      const input: AiConfigurationInput = {
        apiKey: submittedKey,
        region,
        tier,
        ageConfirmed,
        billingConfirmed,
        exposureAcknowledged,
        limitsConfirmed,
        effectiveDailyCap: dailyCap,
      };
      const result = await saveAndTestAiConfiguration(input);
      setConfiguration(result.configuration);
      if (result.configuration.hasKey) setKey("");
      if (result.ok) {
        setMessage(`Connection verified for ${result.models.join(", ")}.`);
        onDismiss?.();
      } else {
        setError(result.message);
      }
    } catch {
      setError(
        "StudyHub could not confirm that the key was saved and tested. Check the local server, then retry; the key remains in this form.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function continueWithoutAi() {
    setBusy(true);
    setError("");
    try {
      const status = await dismissAiSetup();
      setConfiguration(status);
      onDismiss?.();
    } catch {
      setError("StudyHub could not remember this choice on the local server.");
    } finally {
      setBusy(false);
    }
  }

  async function removeKey() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const status = await removeAiKey();
      setConfiguration(status);
      setMessage("The saved Gemini key was removed from this computer.");
    } catch {
      setError("The local server could not remove the saved Gemini key.");
    } finally {
      setBusy(false);
    }
  }

  const regionNeedsPaid = region !== "" && region !== "non-eea-uk-ch";

  return (
    <section
      aria-labelledby="ai-configuration-heading"
      className="rounded-[22px] border border-line bg-surface p-5 shadow-panel sm:p-7"
    >
      <header>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">
          OPTIONAL · LOCAL SERVER ONLY
        </p>
        <h2 className="text-[17px] font-semibold text-ink" id="ai-configuration-heading">
          Gemini AI configuration
        </h2>
        <p className="mt-2 text-[12px] leading-5 text-muted">
          The API key is protected with Windows DPAPI and stored only by this
          local server. It is not saved in browser storage or sent directly to
          Google from this page. StudyHub never contacts Google automatically.
          AI request routes require the local server&apos;s explicit
          `STUDY_HUB_AI_ENABLED=1` setting.
        </p>
      </header>

      {firstLaunch && (
        <button
          className="mt-4 rounded-xl border border-line px-4 py-2.5 text-[11px] font-medium text-ink hover:bg-subtle disabled:opacity-50"
          disabled={busy}
          onClick={() => void continueWithoutAi()}
          type="button"
        >
          Continue without AI
        </button>
      )}

      <p className="mt-4 rounded-xl bg-canvas p-3 text-[11px] leading-5 text-ink" role="status">
        {configuration ? statusMessage(configuration) : "Checking local AI configuration…"}
      </p>
      {configuration?.gateReason && (
        <p className="mt-2 text-[11px] leading-5 text-muted">
          Readiness gate: {configuration.gateReason}
        </p>
      )}
      {error && <p className="mt-3 text-[11px] text-red-700 dark:text-red-200" role="alert">{error}</p>}
      {message && <p className="mt-3 text-[11px] text-emerald-800 dark:text-emerald-200" role="status">{message}</p>}
      {busy && (
        <p className="mt-3 text-[11px] text-muted" role="status">
          Saving the key securely on this computer, then checking Gemini model access…
        </p>
      )}

      <form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}>
        <label className="block text-[11px] font-medium text-ink" htmlFor="gemini-key">
          {configuration?.hasKey ? "Replace Gemini API key (leave blank to keep current key)" : "Gemini API key"}
          <input
            autoComplete="new-password"
            className="mt-2 block w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[12px] text-ink"
            disabled={busy}
            id="gemini-key"
            onChange={(event) => setKey(event.target.value)}
            type="password"
            value={key}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-[11px] font-medium text-ink" htmlFor="ai-region">
            Region
            <select
              className="mt-2 block w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[11px] text-ink"
              disabled={busy}
              id="ai-region"
              onChange={(event) => setRegion(event.target.value as AiConfiguredRegion | "")}
              value={region}
            >
              <option value="">Choose your region</option>
              {REGION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-ink" htmlFor="ai-tier">
            Google project tier
            <select
              className="mt-2 block w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-[11px] text-ink"
              disabled={busy}
              id="ai-tier"
              onChange={(event) => setTier(event.target.value as AiConfiguredTier | "")}
              value={tier}
            >
              <option value="">Choose your tier</option>
              <option value="free">Free</option>
              <option value="paid">Paid — active Cloud Billing account</option>
            </select>
          </label>
        </div>

        <p className="text-[10px] leading-5 text-muted">
          Confirm that your country appears in Google&apos;s{" "}
          <a className="text-brand underline" href="https://ai.google.dev/gemini-api/docs/available-regions" rel="noreferrer" target="_blank">
            available regions
          </a>
          . EEA, Swiss, and UK configurations require an active Paid Services
          project as a conservative local safeguard.
        </p>

        <label className="block text-[11px] font-medium text-ink" htmlFor="ai-daily-cap">
          Local daily request cap (1–100)
          <input
            className="mt-2 block w-32 rounded-xl border border-line bg-canvas px-3 py-2.5 text-[11px] text-ink"
            disabled={busy}
            id="ai-daily-cap"
            max={100}
            min={1}
            onChange={(event) => setDailyCap(Number(event.target.value))}
            type="number"
            value={dailyCap}
          />
        </label>

        <label className="flex items-start gap-2 text-[11px] leading-5 text-ink">
          <input checked={ageConfirmed} className="mt-1" disabled={busy} onChange={(event) => setAgeConfirmed(event.target.checked)} type="checkbox" />
          I am at least 18 years old, as required by the current Gemini API terms.
        </label>
        {(regionNeedsPaid || tier === "paid") && (
          <label className="flex items-start gap-2 text-[11px] leading-5 text-ink">
            <input checked={billingConfirmed} className="mt-1" disabled={busy} onChange={(event) => setBillingConfirmed(event.target.checked)} type="checkbox" />
            I confirm this Google Cloud project has an active billing account.
          </label>
        )}
        <label className="flex items-start gap-2 text-[11px] leading-5 text-ink">
          <input checked={limitsConfirmed} className="mt-1" disabled={busy} onChange={(event) => setLimitsConfirmed(event.target.checked)} type="checkbox" />
          I checked this project&apos;s current limits in AI Studio and set a local cap that does not exceed them.
        </label>

        <DisclosurePanel surfaceLabel="Gemini AI" />
        <label className="flex items-start gap-2 text-[11px] leading-5 text-ink">
          <input checked={exposureAcknowledged} className="mt-1" disabled={busy} onChange={(event) => setExposureAcknowledged(event.target.checked)} type="checkbox" />
          I have read and accept all M1–M8 disclosures above.
        </label>

        <p className="rounded-xl bg-canvas p-3 text-[10px] leading-5 text-muted">
          The owner reports that Google confirmed this personal, single-user
          coursework use on 2026-11-02. The response was not supplied in the
          project files, so its exact wording and scope are not independently
          verified. This record does not claim any broader Google approval.
        </p>
        <p className="text-[10px] leading-5 text-muted">
          “Save key and test connection” sends only the configured model names
          and key to Google&apos;s model metadata endpoint. It sends no study
          material and generates no content. It runs only after this explicit
          button press.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-xl bg-brand px-4 py-2.5 text-[11px] font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
            disabled={busy || !configuration}
            type="submit"
          >
            {busy ? "Saving key and testing connection…" : "Save key and test connection"}
          </button>
          {configuration?.hasKey && (
            <button
              className="rounded-xl border border-line px-4 py-2.5 text-[11px] font-medium text-ink hover:bg-subtle disabled:opacity-50"
              disabled={busy}
              onClick={() => void removeKey()}
              type="button"
            >
              Remove saved key
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

export function AiFirstLaunchPrompt() {
  const [show, setShow] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    void fetchAiConfiguration()
      .then((status) => {
        if (active && !status.hasKey && !status.setupSkipped) setShow(true);
      })
      .catch(() => {
        if (active) {
          setLoadError(
            "Optional Gemini setup is unavailable. StudyHub remains usable; you can try again in Settings.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return (
      <p
        className="mx-auto mt-4 w-full max-w-[1500px] px-5 text-[11px] text-muted sm:px-8 xl:px-12"
        role="status"
      >
        {loadError}
      </p>
    );
  }
  if (!show) return null;
  return (
    <aside className="mx-auto mt-4 w-full max-w-[1500px] px-5 sm:px-8 xl:px-12">
      <div className="mb-4 rounded-2xl border border-brand/30 bg-brand-soft p-4">
          <h2 className="text-base font-semibold text-ink">Set up optional Gemini AI?</h2>
          <p className="mt-1 text-[11px] leading-5 text-muted">
            You can configure a server-protected key now or continue using
            every local StudyHub feature without AI. This choice never blocks
            navigation, and you may dismiss this panel without affecting local
            StudyHub features.
          </p>
      </div>
      <AiConfigurationPanel firstLaunch onDismiss={() => setShow(false)} />
    </aside>
  );
}
