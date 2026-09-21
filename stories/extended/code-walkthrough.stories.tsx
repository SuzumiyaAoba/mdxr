import type { Meta, StoryObj } from "@storybook/react-vite";

import { CodeWalkthrough } from "../../src/ui/document-tabs.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        code: "const value = 2;\nreturn value * 3;",
        explanation: "Read the input.",
        lines: "1",
        title: "Parse",
      },
      {
        code: "const value = 2;\nreturn value * 3;",
        explanation: "Return three times the input.",
        lines: "2",
        title: "Compute",
      },
    ]),
  },
  component: CodeWalkthrough,
  parameters: {
    docs: {
      description: {
        component: CodeWalkthrough.__mdxr?.description,
      },
    },
  },
  title: "Components/CodeWalkthrough",
} satisfies Meta<typeof CodeWalkthrough>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
