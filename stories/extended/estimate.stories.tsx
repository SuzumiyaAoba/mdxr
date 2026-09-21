import type { Meta, StoryObj } from "@storybook/react-vite";

import { Estimate } from "../../src/ui/planning-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        likely: 4,
        name: "Parser",
        optimistic: 2,
        pessimistic: 8,
        unit: "days",
      },
    ]),
  },
  component: Estimate,
  parameters: {
    docs: {
      description: {
        component: Estimate.__mdxr?.description,
      },
    },
  },
  title: "Components/Estimate",
} satisfies Meta<typeof Estimate>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
