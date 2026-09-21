import type { Meta, StoryObj } from "@storybook/react-vite";

import { DataValidation } from "../../src/ui/evaluation-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        age: 21,
        id: "a",
      },
      {
        age: -1,
        id: "b",
      },
    ]),
    options: JSON.stringify({
      rules: [
        {
          field: "age",
          min: 0,
          required: true,
          type: "number",
        },
      ],
    }),
  },
  component: DataValidation,
  parameters: {
    docs: {
      description: {
        component: DataValidation.__mdxr?.description,
      },
    },
  },
  title: "Components/DataValidation",
} satisfies Meta<typeof DataValidation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
