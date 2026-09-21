import type { Meta, StoryObj } from "@storybook/react-vite";

import { DataTable } from "../../src/ui/data-table.js";
import { RecordItem } from "../../src/ui/record-item.js";

const meta = {
  args: {
    name: "API",
    status: "ready",
    value: "12",
  },
  component: RecordItem,
  parameters: {
    docs: {
      description: {
        component: RecordItem.__mdxr?.description,
      },
    },
  },
  render: (args) => (
    <DataTable>
      <RecordItem {...args} />
      <RecordItem name="CLI" value="8" status="pending" />
    </DataTable>
  ),
  title: "Components/RecordItem",
} satisfies Meta<typeof RecordItem>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
