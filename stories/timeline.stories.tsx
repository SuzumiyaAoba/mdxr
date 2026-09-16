import type { Meta, StoryObj } from "@storybook/react-vite";

import { Event, Timeline } from "../src/ui/timeline.js";

const meta = {
  component: Timeline,
  title: "Components/Timeline",
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Milestones: Story = {
  render: () => (
    <Timeline title="Milestones">
      <Event date="2026-09-10" status="done" title="Skeleton renderer merged" />
      <Event date="2026-09-15" status="doing" title="Custom component support">
        <p>esbuild-based loading, catalog command.</p>
      </Event>
      <Event date="2026-09-30" status="todo" title="v1.0 freeze" />
    </Timeline>
  ),
};

export const NoTitle: Story = {
  render: () => (
    <Timeline>
      <Event date="2026-09-10">Plain entry without status.</Event>
    </Timeline>
  ),
};
