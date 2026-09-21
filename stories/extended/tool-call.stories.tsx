import type { Meta, StoryObj } from "@storybook/react-vite";

import { ToolCall } from "../../src/ui/evaluation-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        arguments: "Arguments",
        duration: "Duration",
        result: "pass",
        status: "open",
        tool: "Tool",
      },
    ]),
  },
  component: ToolCall,
  parameters: {
    docs: {
      description: {
        component: ToolCall.__mdxr?.description,
      },
    },
  },
  title: "Components/ToolCall",
} satisfies Meta<typeof ToolCall>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
