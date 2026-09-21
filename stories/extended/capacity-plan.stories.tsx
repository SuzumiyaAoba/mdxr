import type { Meta, StoryObj } from "@storybook/react-vite";

import { CapacityPlan } from "../../src/ui/planning-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        allocated: 32,
        capacity: 40,
        name: "Platform",
      },
      {
        allocated: 24,
        capacity: 20,
        name: "Design",
      },
    ]),
  },
  component: CapacityPlan,
  parameters: {
    docs: {
      description: {
        component: CapacityPlan.__mdxr?.description,
      },
    },
  },
  title: "Components/CapacityPlan",
} satisfies Meta<typeof CapacityPlan>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
