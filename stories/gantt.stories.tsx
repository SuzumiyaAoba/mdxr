import type { Meta, StoryObj } from "@storybook/react-vite";

import { Gantt, Milestone, Task } from "../src/ui/gantt.js";

const meta = {
  component: Gantt,
  title: "Components/Gantt",
} satisfies Meta<typeof Gantt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReleasePlan: Story = {
  render: () => (
    <Gantt title="v1.0 release">
      <Task
        end="2026-09-05"
        name="API design"
        start="2026-09-01"
        status="done"
      />
      <Task
        end="2026-09-18"
        name="Implementation"
        owner="aoba"
        progress="40"
        start="2026-09-08"
        status="doing"
      />
      <Task
        end="2026-09-25"
        name="Docs"
        note="usage + catalog"
        start="2026-09-21"
      />
      <Task
        end="2026-09-30"
        name="Release prep"
        start="2026-09-28"
        status="blocked"
      />
      <Milestone date="2026-09-30" name="v1.0 freeze" />
    </Gantt>
  ),
};

export const RangeOverride: Story = {
  render: () => (
    <Gantt
      end="2026-12-31"
      start="2026-10-01"
      title="Q4 roadmap"
      today="2026-10-15"
    >
      <Task end="2026-10-20" name="Phase 1" start="2026-10-01" />
      <Task
        end="2026-12-10"
        name="Phase 2"
        progress="10"
        start="2026-11-01"
        status="doing"
      />
      <Milestone date="2026-12-24" name="ship" status="done" />
    </Gantt>
  ),
};
