import type { Meta, StoryObj } from "@storybook/react-vite";

import { DecisionMatrix } from "../../src/ui/planning-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        cost: 9,
        name: "Simple",
        reliability: 6,
      },
      {
        cost: 5,
        name: "Resilient",
        reliability: 9,
      },
    ]),
    options: JSON.stringify({
      weights: {
        cost: 0.4,
        reliability: 0.6,
      },
    }),
  },
  component: DecisionMatrix,
  parameters: {
    docs: {
      description: {
        component: DecisionMatrix.__mdxr?.description,
      },
    },
  },
  title: "Components/DecisionMatrix",
} satisfies Meta<typeof DecisionMatrix>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
