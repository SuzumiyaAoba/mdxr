import type { Meta, StoryObj } from "@storybook/react-vite";

import { Conversation } from "../../src/ui/document-tabs.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        content: "Summarize the build.",
        role: "user",
        time: "10:00",
      },
      {
        content: "All checks passed.",
        role: "assistant",
        time: "10:01",
      },
    ]),
  },
  component: Conversation,
  parameters: {
    docs: {
      description: {
        component: Conversation.__mdxr?.description,
      },
    },
  },
  title: "Components/Conversation",
} satisfies Meta<typeof Conversation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
