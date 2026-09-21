import type { Meta, StoryObj } from "@storybook/react-vite";

import { SyncedTabs, TabItem } from "../../src/ui/document-tabs.js";

const meta = {
  args: {
    syncKey: "platform",
  },
  component: SyncedTabs,
  parameters: {
    docs: {
      description: {
        component: SyncedTabs.__mdxr?.description,
      },
    },
  },
  render: (args) => (
    <>
      <SyncedTabs {...args}>
        <TabItem label="Linux">
          <p>Linux instructions 1</p>
        </TabItem>
        <TabItem label="macOS">
          <p>macOS instructions 1</p>
        </TabItem>
      </SyncedTabs>
      <SyncedTabs {...args}>
        <TabItem label="Linux">
          <p>Linux instructions 2</p>
        </TabItem>
        <TabItem label="macOS">
          <p>macOS instructions 2</p>
        </TabItem>
      </SyncedTabs>
    </>
  ),
  title: "Components/SyncedTabs",
} satisfies Meta<typeof SyncedTabs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
