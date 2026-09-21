import type { Meta, StoryObj } from "@storybook/react-vite";

import { ErrorBudget } from "../../src/ui/operations-reports.js";

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
  component: ErrorBudget,
  parameters: {
    docs: {
      description: {
        component: ErrorBudget.__mdxr?.description,
      },
    },
  },
  title: "Components/ErrorBudget",
} satisfies Meta<typeof ErrorBudget>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
