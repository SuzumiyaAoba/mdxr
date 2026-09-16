import type { Meta, StoryObj } from "@storybook/react-vite";

import { Columns } from "../src/ui/columns.js";
import { After, Before } from "../src/ui/compare.js";

const meta = {
  component: Before,
  title: "Components/BeforeAfter",
} satisfies Meta<typeof Before>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SideBySide: Story = {
  render: () => (
    <Columns>
      <Before>
        <code>render(str)</code> — string templates, no validation.
      </Before>
      <After>
        <code>render(doc)</code> — typed pipeline with prop schemas.
      </After>
    </Columns>
  ),
};

export const CustomLabels: Story = {
  render: () => (
    <Columns>
      <Before title="Current">Ad-hoc HTML strings.</Before>
      <After title="Proposed">Component catalog + MDX.</After>
    </Columns>
  ),
};
