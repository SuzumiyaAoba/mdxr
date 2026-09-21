import type { Meta, StoryObj } from "@storybook/react-vite";

import { ModelComparison } from "../../src/ui/evaluation-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        cost: "Cost",
        failures: "Failures",
        latency: "Latency",
        model: "Model",
        notes: "Reviewed with the team.",
        quality: "Quality",
        task: "Task",
      },
    ]),
  },
  component: ModelComparison,
  parameters: {
    docs: {
      description: {
        component: ModelComparison.__mdxr?.description,
      },
    },
  },
  title: "Components/ModelComparison",
} satisfies Meta<typeof ModelComparison>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
