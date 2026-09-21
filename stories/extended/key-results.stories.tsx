import type { Meta, StoryObj } from "@storybook/react-vite";

import { KeyResults } from "../../src/ui/planning-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        baseline: 80,
        current: 92,
        name: "Pass rate",
        target: 99,
      },
    ]),
  },
  component: KeyResults,
  parameters: {
    docs: {
      description: {
        component: KeyResults.__mdxr?.description,
      },
    },
  },
  title: "Components/KeyResults",
} satisfies Meta<typeof KeyResults>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
