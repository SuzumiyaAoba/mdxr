import type { Meta, StoryObj } from "@storybook/react-vite";

import { Request } from "../../src/ui/document-tabs.js";

const meta = {
  args: {
    headers: "Accept: application/json",
    method: "GET",
    path: "/items",
  },
  component: Request,
  parameters: {
    docs: {
      description: {
        component: Request.__mdxr?.description,
      },
    },
  },
  title: "Components/Request",
} satisfies Meta<typeof Request>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
