import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AiErrorNotice } from "./AiErrorNotice";
import type { AiClientFailure } from "./aiTypes";

const notSent: AiClientFailure = {
  code: "terms_not_eligible",
  message: "Provider eligibility is unresolved.",
  upstreamAttempted: false,
  outcome: "not_sent",
};

const afterSendingRateLimit: AiClientFailure = {
  code: "rate_limit_exceeded",
  message: "Too many requests.",
  upstreamAttempted: true,
  outcome: "failed_after_sending",
};

const afterSendingQuota: AiClientFailure = {
  code: "quota_exceeded",
  message: "Daily quota is exhausted.",
  upstreamAttempted: true,
  outcome: "failed_after_sending",
};

const unknown: AiClientFailure = {
  code: "outcome_unknown",
  message: "No usable response was received.",
  upstreamAttempted: null,
  outcome: "unknown",
};

describe("AiErrorNotice", () => {
  it("keeps the Class A privacy statement explicit and offers no retry", () => {
    render(<AiErrorNotice failure={notSent} />);

    const alert = screen.getByRole("alert", { name: "Not sent" });
    expect(within(alert).getByText("Not sent")).toBeInTheDocument();
    expect(
      within(alert).getByText(/so no provider request can be made/),
    ).toBeInTheDocument();
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
    expect(alert).toHaveAttribute("data-outcome", "not_sent");
  });

  it("distinguishes rate limiting from quota exhaustion by code", () => {
    const { rerender } = render(
      <AiErrorNotice failure={afterSendingRateLimit} />,
    );

    expect(
      screen.getByText(/This is not assumed to mean the daily quota is exhausted/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Request failed after sending"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Not sent")).not.toBeInTheDocument();

    rerender(<AiErrorNotice failure={afterSendingQuota} />);

    expect(
      screen.getByText(/daily quota is exhausted/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/This is not assumed to mean the daily quota is exhausted/),
    ).not.toBeInTheDocument();
  });

  it("never presents an unknown outcome as Not sent", () => {
    render(<AiErrorNotice failure={unknown} />);

    const alert = screen.getByRole("alert", {
      name: "Request outcome unknown",
    });
    expect(alert).toHaveAttribute("data-outcome", "unknown");
    expect(screen.queryByText("Not sent")).not.toBeInTheDocument();
    expect(
      within(alert).getByText(/not a confirmed pre-send refusal/),
    ).toBeInTheDocument();
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
  });
});
