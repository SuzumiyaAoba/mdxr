import type { Meta, StoryObj } from "@storybook/react-vite";

import { SyncedTabs, TabItem } from "../../src/ui/document-tabs.js";

const meta = {
  args: {
    label: "Linux",
  },
  component: TabItem,
  parameters: {
    docs: {
      description: {
        component: TabItem.__mdxr?.description,
      },
    },
  },
  render: (args) => (
    <SyncedTabs syncKey="platform">
      <TabItem {...args}>
        <p>Linux instructions 1</p>
      </TabItem>
      <TabItem label="macOS">
        <p>macOS instructions 1</p>
      </TabItem>
    </SyncedTabs>
  ),
  title: "Components/TabItem",
} satisfies Meta<typeof TabItem>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
