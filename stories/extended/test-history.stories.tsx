import type { Meta, StoryObj } from "@storybook/react-vite";

import { TestHistory } from "../../src/ui/quality-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        name: "Compile",
        runs: ["pass", "pass", "pass"],
      },
      {
        name: "Network",
        runs: ["pass", "fail", "pass"],
      },
    ]),
  },
  component: TestHistory,
  parameters: {
    docs: {
      description: {
        component: TestHistory.__mdxr?.description,
      },
    },
  },
  title: "Components/TestHistory",
} satisfies Meta<typeof TestHistory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
