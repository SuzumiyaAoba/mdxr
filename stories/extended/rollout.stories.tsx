import type { Meta, StoryObj } from "@storybook/react-vite";

import { Rollout } from "../../src/ui/operations-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        gate: "Gate",
        metric: "Metric",
        percent: "Percent",
        rollback: "Rollback",
        stage: "Stage",
        status: "open",
        target: "Target",
      },
    ]),
  },
  component: Rollout,
  parameters: {
    docs: {
      description: {
        component: Rollout.__mdxr?.description,
      },
    },
  },
  title: "Components/Rollout",
} satisfies Meta<typeof Rollout>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
