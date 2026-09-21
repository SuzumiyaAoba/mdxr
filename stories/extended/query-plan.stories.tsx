import type { Meta, StoryObj } from "@storybook/react-vite";

import { QueryPlan } from "../../src/ui/semantic-diagrams.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        actualRows: 120,
        estimatedRows: 100,
        id: "scan",
        operation: "Index scan",
        time: 5,
      },
      {
        actualRows: 100,
        estimatedRows: 10,
        id: "join",
        operation: "Nested loop",
        parent: "scan",
        time: 12,
      },
    ]),
  },
  component: QueryPlan,
  parameters: {
    docs: {
      description: {
        component: QueryPlan.__mdxr?.description,
      },
    },
  },
  title: "Components/QueryPlan",
} satisfies Meta<typeof QueryPlan>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
