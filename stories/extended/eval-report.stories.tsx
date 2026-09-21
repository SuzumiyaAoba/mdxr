import type { Meta, StoryObj } from "@storybook/react-vite";

import { EvalReport } from "../../src/ui/evaluation-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        actual: "4",
        expected: "4",
        id: "E1",
        input: "2+2",
      },
      {
        actual: "7",
        expected: "6",
        id: "E2",
        input: "3+3",
      },
    ]),
  },
  component: EvalReport,
  parameters: {
    docs: {
      description: {
        component: EvalReport.__mdxr?.description,
      },
    },
  },
  title: "Components/EvalReport",
} satisfies Meta<typeof EvalReport>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
