import type { Meta, StoryObj } from "@storybook/react-vite";

import { Phase } from "../src/ui/phase.js";
import { Plan } from "../src/ui/plan.js";
import { Summary } from "../src/ui/summary.js";

const meta = {
  args: { status: "doing", title: "Renderer rewrite" },
  component: Plan,
  title: "Components/Plan",
} satisfies Meta<typeof Plan>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithHeader: Story = {
  render: (args) => (
    <Plan {...args}>
      <Summary done="4" label="Overall progress" total="9" />
      <Phase status="done" title="Phase 1 — pipeline">
        <p>MDX compile via evaluate() plus Tailwind v4 runtime CSS.</p>
      </Phase>
      <Phase status="doing" title="Phase 2 — extensibility">
        <p>Project-defined components loaded through mdxr.config.ts.</p>
      </Phase>
    </Plan>
  ),
};

export const NoHeader: Story = {
  args: { status: undefined, title: undefined },
  render: (args) => (
    <Plan {...args}>
      <p>
        Body content only — the header disappears when both props are empty.
      </p>
    </Plan>
  ),
};
