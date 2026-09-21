import type { Meta, StoryObj } from "@storybook/react-vite";

import { SLO } from "../../src/ui/operations-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        bad: 40,
        name: "API availability",
        target: 99.9,
        total: 100_000,
      },
    ]),
  },
  component: SLO,
  parameters: {
    docs: {
      description: {
        component: SLO.__mdxr?.description,
      },
    },
  },
  title: "Components/SLO",
} satisfies Meta<typeof SLO>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
