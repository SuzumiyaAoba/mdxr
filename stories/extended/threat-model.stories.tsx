import type { Meta, StoryObj } from "@storybook/react-vite";

import { ThreatModel } from "../../src/ui/operations-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        asset: "Asset",
        control: "Control",
        owner: "Platform",
        path: "Path",
        residual: "Residual",
        threat: "Threat",
      },
    ]),
  },
  component: ThreatModel,
  parameters: {
    docs: {
      description: {
        component: ThreatModel.__mdxr?.description,
      },
    },
  },
  title: "Components/ThreatModel",
} satisfies Meta<typeof ThreatModel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
