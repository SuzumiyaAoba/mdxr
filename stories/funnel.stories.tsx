import type { Meta, StoryObj } from "@storybook/react-vite";

import { Funnel, Stage } from "../src/ui/funnel.js";

const meta = {
  component: Funnel,
  title: "Components/Funnel",
} satisfies Meta<typeof Funnel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Signup: Story = {
  render: () => (
    <Funnel title="signup funnel" unit="users">
      <Stage name="visited" value="12800" />
      <Stage name="signed up" value="3400" />
      <Stage name="activated" note="first deploy" value="1500" />
      <Stage name="paid" tone="emerald" value="420" />
    </Funnel>
  ),
};

export const Pipeline: Story = {
  render: () => (
    <Funnel title="incident response">
      <Stage name="alerts" value="240" />
      <Stage name="triaged" value="180" />
      <Stage name="mitigated" value="96" />
      <Stage name="postmortem" value="40" />
    </Funnel>
  ),
};
