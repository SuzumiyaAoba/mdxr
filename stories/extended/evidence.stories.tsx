import type { Meta, StoryObj } from "@storybook/react-vite";

import { Evidence } from "../../src/ui/evidence-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        captured: "Captured",
        claim: "Claim",
        commit: "Commit",
        environment: "staging",
        result: "pass",
        source: "Source",
      },
    ]),
  },
  component: Evidence,
  parameters: {
    docs: {
      description: {
        component: Evidence.__mdxr?.description,
      },
    },
  },
  title: "Components/Evidence",
} satisfies Meta<typeof Evidence>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
