import type { Meta, StoryObj } from "@storybook/react-vite";

import { Runbook } from "../../src/ui/operations-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        command: "Command",
        expected: "Ready",
        prerequisite: "Prerequisite",
        recovery: "Recovery",
        step: "Step",
        stop: "Stop",
      },
    ]),
  },
  component: Runbook,
  parameters: {
    docs: {
      description: {
        component: Runbook.__mdxr?.description,
      },
    },
  },
  title: "Components/Runbook",
} satisfies Meta<typeof Runbook>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
