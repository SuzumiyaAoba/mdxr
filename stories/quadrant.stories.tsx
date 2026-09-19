import type { Meta, StoryObj } from "@storybook/react-vite";

import { Pin, Quadrant } from "../src/ui/quadrant.js";

const meta = {
  component: Quadrant,
  title: "Components/Quadrant",
} satisfies Meta<typeof Quadrant>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TechRadar: Story = {
  render: () => (
    <Quadrant
      quadrants="invest,bet,maintain,drop"
      title="capability map"
      x="adoption"
      y="impact"
    >
      <Pin name="mdxr" tone="sky" x="78" y="85" />
      <Pin name="charts" note="this PR" tone="emerald" x="60" y="70" />
      <Pin name="themes" x="45" y="30" />
      <Pin name="plugins" tone="amber" x="25" y="55" />
      <Pin name="legacy" tone="red" x="15" y="15" />
    </Quadrant>
  ),
};

export const Priorities: Story = {
  render: () => (
    <Quadrant
      quadrants="do first,schedule,delegate,eliminate"
      title="eisenhower"
      x="urgency"
      y="importance"
    >
      <Pin name="release" x="85" y="90" />
      <Pin name="refactor" x="30" y="75" />
      <Pin name="triage" x="70" y="25" />
      <Pin name="bikeshed" x="10" y="10" />
    </Quadrant>
  ),
};
