import type { Meta, StoryObj } from "@storybook/react-vite";

import { FileRef } from "../src/ui/file-ref.js";
import { Hypotheses, Hypothesis } from "../src/ui/hypothesis.js";

const meta = {
  component: Hypotheses,
  title: "Components/Hypotheses",
} satisfies Meta<typeof Hypotheses>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ledger: Story = {
  render: () => (
    <Hypotheses title="Hypotheses tested">
      <Hypothesis status="supported" title="Directives expand before eval">
        <p>
          The <code>:::flow</code> container is rewritten to JSX by the remark
          plugin — see <FileRef path="src/remark/directives.ts" />.
        </p>
      </Hypothesis>
      <Hypothesis status="refuted" title="CSS is fetched at runtime">
        <p>
          Ruled out: the compiled stylesheet is inlined into the HTML at render
          time.
        </p>
      </Hypothesis>
      <Hypothesis status="untested" title="Serve mode watches config">
        <p>Plausible, but no test covers the watch path yet.</p>
      </Hypothesis>
    </Hypotheses>
  ),
};

export const Single: Story = {
  render: () => (
    <Hypothesis status="supported" title="Standalone hypothesis">
      <p>Usable without the container — no number chip is shown.</p>
    </Hypothesis>
  ),
};
