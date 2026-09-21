import type { Meta, StoryObj } from "@storybook/react-vite";

import { Response } from "../../src/ui/document-tabs.js";

const meta = {
  args: {
    body: JSON.stringify({
      items: ["one"],
    }),
    status: "200",
  },
  component: Response,
  parameters: {
    docs: {
      description: {
        component: Response.__mdxr?.description,
      },
    },
  },
  title: "Components/Response",
} satisfies Meta<typeof Response>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
