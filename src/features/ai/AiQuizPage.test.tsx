import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AiQuizPage } from "./AiQuizPage";
import { AI_APPROVAL_WORDING } from "./PayloadPreview";
import { AI_DISCLOSURES } from "./disclosures";
import { createStubAiFetch } from "./testing/stubAiFetch";

const source = {
  id: "material-1",
  title: "Water cycle",
  text: "Evaporation changes liquid water into vapor. Condensation forms clouds.",
};

describe("AiQuizPage", () => {
  it("shows all disclosures and grades only after every answer is selected", async () => {
    const user = userEvent.setup();
    const stub = createStubAiFetch();

    const { container } = render(<AiQuizPage fetch={stub.fetch} source={source} />);

    expect(
      screen.getByRole("heading", { name: "Read these before using AI quizzes" }),
    ).toBeInTheDocument();
    for (const disclosure of AI_DISCLOSURES) {
      expect(screen.getByText(disclosure.text)).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "Prepare exact payload" }));
    const payloadPreview = container.querySelector(
      'pre[aria-label="Exact outbound payload text"]',
    );
    expect(payloadPreview?.textContent).toBe(stub.prepared[0].payloadText);
    await user.click(await screen.findByLabelText(AI_APPROVAL_WORDING));
    await user.click(screen.getByRole("button", { name: "Send approved quiz request" }));

    expect(
      await screen.findByText(/Which concept appears in the supplied study material\?/),
    ).toBeInTheDocument();
    const check = screen.getByRole("button", { name: "Check answers" });
    expect(check).toBeDisabled();
    expect(screen.getByText("COMPLETE · gemini-stub-model")).toBeInTheDocument();
    expect(stub.dispatched[0].payloadText).toBe(payloadPreview?.textContent);

    await user.click(screen.getByLabelText("A supplied concept"));
    expect(check).toBeEnabled();
    await user.click(check);

    expect(screen.getByRole("status")).toHaveTextContent("Score: 1 of 1 correct.");
    expect(screen.getByText(/Correct\. The first option/)).toBeInTheDocument();
    expect(screen.getByLabelText("A supplied concept")).toBeDisabled();
    expect(stub.dispatched).toHaveLength(1);
  });

  it("shows local excerpts without making any fetch call", async () => {
    const user = userEvent.setup();
    const stub = createStubAiFetch();

    render(<AiQuizPage fetch={stub.fetch} source={source} />);
    await user.click(screen.getByRole("button", { name: "Use local fallback" }));

    expect(screen.getByRole("region", { name: "Local quiz fallback" })).toHaveTextContent(
      "Local study fallback — not a generated quiz.",
    );
    expect(screen.getByText("Evaporation changes liquid water into vapor.")).toBeInTheDocument();
    expect(stub.calls).toHaveLength(0);
    expect(stub.dispatched).toHaveLength(0);
  });

  it("renders invalid provider output as inert raw text", async () => {
    const user = userEvent.setup();
    const stub = createStubAiFetch({
      send: { kind: "success", outputText: "<script>unsafe()</script>" },
    });

    render(<AiQuizPage fetch={stub.fetch} source={source} />);
    await user.click(screen.getByRole("button", { name: "Prepare exact payload" }));
    await user.click(await screen.findByLabelText(AI_APPROVAL_WORDING));
    await user.click(screen.getByRole("button", { name: "Send approved quiz request" }));

    expect(await screen.findByText("<script>unsafe()</script>")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.queryByRole("button", { name: "Check answers" })).not.toBeInTheDocument();
  });

  it("does not grade an incomplete response", async () => {
    const user = userEvent.setup();
    const stub = createStubAiFetch({
      send: {
        kind: "incomplete",
        outputText: JSON.stringify({
          questions: [
            {
              question: "Partial question?",
              options: ["A", "B"],
              correctIndex: 0,
              explanation: "Partial explanation.",
            },
          ],
        }),
      },
    });

    render(<AiQuizPage fetch={stub.fetch} source={source} />);
    await user.click(screen.getByRole("button", { name: "Prepare exact payload" }));
    await user.click(await screen.findByLabelText(AI_APPROVAL_WORDING));
    await user.click(screen.getByRole("button", { name: "Send approved quiz request" }));

    expect(
      await screen.findByText("This partial response is not a complete quiz and cannot be graded."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check answers" })).not.toBeInTheDocument();
    expect(screen.getByText(/Partial question/)).toBeInTheDocument();
    expect(stub.dispatched).toHaveLength(1);
  });
});
