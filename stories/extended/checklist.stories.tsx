import type { Meta, StoryObj } from "@storybook/react-vite";

import { Checklist } from "../../src/ui/document-inputs.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        checked: true,
        id: "tests",
        label: "Run tests",
        owner: "Platform",
      },
      {
        checked: false,
        id: "review",
        label: "Review changes",
      },
    ]),
  },
  component: Checklist,
  parameters: {
    docs: {
      description: {
        component: Checklist.__mdxr?.description,
      },
    },
  },
  title: "Components/Checklist",
} satisfies Meta<typeof Checklist>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
