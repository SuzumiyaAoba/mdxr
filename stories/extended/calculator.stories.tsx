import type { Meta, StoryObj } from "@storybook/react-vite";

import { Calculator } from "../../src/ui/document-inputs.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        label: "Users",
        min: 0,
        name: "users",
        value: 100,
      },
      {
        label: "Price",
        min: 0,
        name: "price",
        value: 12,
      },
    ]),
    operation: "product",
    unit: "USD",
  },
  component: Calculator,
  parameters: {
    docs: {
      description: {
        component: Calculator.__mdxr?.description,
      },
    },
  },
  title: "Components/Calculator",
} satisfies Meta<typeof Calculator>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Ratio: Story = {
  args: {
    data: JSON.stringify([
      {
        label: "Completed",
        min: 0,
        name: "completed",
        value: 8,
      },
      {
        label: "Total",
        min: 0,
        name: "total",
        value: 10,
      },
    ]),
    operation: "ratio",
    unit: "",
  },
};
export const InvalidInput: Story = {
  args: {
    data: JSON.stringify([
      {
        label: "Users",
        min: 0,
        name: "users",
        value: -1,
      },
      {
        label: "Price",
        min: 0,
        name: "price",
        value: 12,
      },
    ]),
  },
};
