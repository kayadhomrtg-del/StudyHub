import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AiQaPage } from "./AiQaPage";
import { AI_APPROVAL_WORDING } from "./PayloadPreview";
import { QA_MAX_QUESTION_CHARACTERS } from "./buildQaInput";
import { AI_DISCLOSURES } from "./disclosures";
import { createStubAiFetch } from "./testing/stubAiFetch";

const source = {
  id: "material-1",
  title: "Water cycle",
  text: "Evaporation changes liquid water into vapor. Condensation forms clouds.",
};

describe("AiQaPage", () => {
  it("shows a local validation error for empty and over-limit questions without fetching", () => {
    const stub = createStubAiFetch();
    render(<AiQaPage fetch={stub.fetch} source={source} />);

    for (const disclosure of AI_DISCLOSURES) {
      expect(screen.getByText(disclosure.text)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Prepare exact Q&A payload" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a question before preparing a request.",
    );

    fireEvent.change(screen.getByLabelText("Question about this material"), {
      target: { value: "q".repeat(QA_MAX_QUESTION_CHARACTERS + 1) },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The question exceeds the 2,000-character limit.",
    );
    expect(screen.getByRole("button", { name: "Prepare exact Q&A payload" })).toBeDisabled();
    expect(stub.calls).toHaveLength(0);
  });

  it("does not prepare a request when the selected material has no text", async () => {
    const user = userEvent.setup();
    const stub = createStubAiFetch();
    render(
      <AiQaPage
        fetch={stub.fetch}
        source={{ ...source, text: " \n " }}
      />,
    );

    await user.type(
      screen.getByLabelText("Question about this material"),
      "What does this material explain?",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No extractable text is available, so an AI answer cannot be prepared.",
    );
    expect(screen.getByRole("button", { name: "Prepare exact Q&A payload" })).toBeDisabled();
    expect(stub.calls).toHaveLength(0);
  });

  it("sends the exact question template and renders unverified references as inert text", async () => {
    const user = userEvent.setup();
    const stub = createStubAiFetch();
    const { container } = render(<AiQaPage fetch={stub.fetch} source={source} />);

    await user.type(
      screen.getByLabelText("Question about this material"),
      "How does condensation form clouds?",
    );
    await user.click(screen.getByRole("button", { name: "Prepare exact Q&A payload" }));
    expect(await screen.findByRole("heading", { name: "Exact outbound Q&A payload" })).toBeInTheDocument();
    const payloadPreview = container.querySelector(
      'pre[aria-label="Exact outbound payload text"]',
    );
    expect(payloadPreview?.textContent).toBe(stub.prepared[0].payloadText);
    await user.click(await screen.findByLabelText(AI_APPROVAL_WORDING));
    await user.click(screen.getByRole("button", { name: "Send approved Q&A request" }));

    expect(await screen.findByRole("region", { name: "AI answer" })).toHaveTextContent(
      "A deterministic answer based only on the supplied study text.",
    );
    expect(screen.getByText("COMPLETE · gemini-stub-model")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "References — provider-reported, not verified",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("A deterministic provider-reported reference.").closest("a")).toBeNull();
    expect(stub.calls).toHaveLength(2);
    expect(stub.dispatched[0].payloadText).toBe(payloadPreview?.textContent);
    expect(stub.calls[0].body).toMatchObject({
      feature: "qa",
      text: expect.stringContaining("How does condensation form clouds?"),
    });
    expect((stub.calls[0].body as { text: string }).text).toContain(source.text);
    expect(stub.dispatched).toHaveLength(1);
  });

  it("shows keyword-matched local excerpts without a fetch call", async () => {
    const user = userEvent.setup();
    const stub = createStubAiFetch();
    render(<AiQaPage fetch={stub.fetch} source={source} />);

    await user.type(
      screen.getByLabelText("Question about this material"),
      "How does condensation form clouds?",
    );
    await user.click(screen.getByRole("button", { name: "Show local source excerpts" }));

    expect(screen.getByRole("region", { name: "Local Q&A fallback" })).toHaveTextContent(
      "Local source excerpts — not an AI answer.",
    );
    expect(screen.getByText("Condensation forms clouds.")).toBeInTheDocument();
    expect(stub.calls).toHaveLength(0);
  });

  it("does not present an incomplete response as an answer", async () => {
    const user = userEvent.setup();
    const stub = createStubAiFetch({
      send: {
        kind: "incomplete",
        outputText: JSON.stringify({
          answer: "Partial answer only.",
          references: ["Unverified partial reference"],
        }),
      },
    });
    render(<AiQaPage fetch={stub.fetch} source={source} />);

    await user.type(
      screen.getByLabelText("Question about this material"),
      "How does condensation work?",
    );
    await user.click(screen.getByRole("button", { name: "Prepare exact Q&A payload" }));
    await user.click(await screen.findByLabelText(AI_APPROVAL_WORDING));
    await user.click(screen.getByRole("button", { name: "Send approved Q&A request" }));

    expect(await screen.findByText("This partial response is not a complete answer.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "AI answer" })).not.toBeInTheDocument();
    expect(screen.getByText(/Partial answer only/)).toBeInTheDocument();
  });
});
