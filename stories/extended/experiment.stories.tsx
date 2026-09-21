import type { Meta, StoryObj } from "@storybook/react-vite";

import { Experiment } from "../../src/ui/evaluation-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        count: 1000,
        name: "Control",
        successes: 80,
      },
      {
        count: 1000,
        name: "Variant",
        successes: 105,
      },
    ]),
  },
  component: Experiment,
  parameters: {
    docs: {
      description: {
        component: Experiment.__mdxr?.description,
      },
    },
  },
  title: "Components/Experiment",
} satisfies Meta<typeof Experiment>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
