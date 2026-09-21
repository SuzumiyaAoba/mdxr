import type { Meta, StoryObj } from "@storybook/react-vite";

import { DataTable } from "../../src/ui/data-table.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        id: "alpha",
        name: "Alpha",
        status: "ready",
        value: 20,
      },
      {
        id: "beta",
        name: "Beta",
        status: "pending",
        value: 10,
      },
      {
        id: "gamma",
        name: "Gamma",
        status: "ready",
        value: 30,
      },
    ]),
  },
  component: DataTable,
  parameters: {
    docs: {
      description: {
        component: DataTable.__mdxr?.description,
      },
    },
  },
  title: "Components/DataTable",
} satisfies Meta<typeof DataTable>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Paginated: Story = {
  args: { pageSize: "2", title: "Inventory" },
};
export const CsvInput: Story = {
  args: {
    data: "name,value,status\nAlpha,20,ready\nBeta,10,pending\nGamma,30,ready",
    format: "csv",
  },
};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
