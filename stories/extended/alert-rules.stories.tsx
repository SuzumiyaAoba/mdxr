import type { Meta, StoryObj } from "@storybook/react-vite";

import { AlertRules } from "../../src/ui/operations-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        condition: "Condition",
        duration: "Duration",
        metric: "Metric",
        name: "Example",
        owner: "Platform",
        runbook: "Runbook",
      },
    ]),
  },
  component: AlertRules,
  parameters: {
    docs: {
      description: {
        component: AlertRules.__mdxr?.description,
      },
    },
  },
  title: "Components/AlertRules",
} satisfies Meta<typeof AlertRules>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
