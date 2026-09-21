import type { Meta, StoryObj } from "@storybook/react-vite";

import { RiskRegister } from "../../src/ui/planning-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        id: "R1",
        impact: 4,
        likelihood: 3,
        mitigation: "Staged rollout",
        owner: "Platform",
        risk: "Migration delay",
        status: "open",
      },
    ]),
  },
  component: RiskRegister,
  parameters: {
    docs: {
      description: {
        component: RiskRegister.__mdxr?.description,
      },
    },
  },
  title: "Components/RiskRegister",
} satisfies Meta<typeof RiskRegister>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
