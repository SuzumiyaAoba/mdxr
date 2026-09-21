import type { Meta, StoryObj } from "@storybook/react-vite";

import { EvalCase } from "../../src/ui/evaluation-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        actual: "4",
        expected: "4",
        id: "E1",
        input: "2+2",
      },
    ]),
  },
  component: EvalCase,
  parameters: {
    docs: {
      description: {
        component: EvalCase.__mdxr?.description,
      },
    },
  },
  title: "Components/EvalCase",
} satisfies Meta<typeof EvalCase>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
