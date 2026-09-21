import type { Meta, StoryObj } from "@storybook/react-vite";

import { ErrorCatalog } from "../../src/ui/reference-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        action: "Run the verification suite",
        cause: "Cause",
        code: "Code",
        href: "Href",
        message: "Message",
        retry: "Retry",
      },
    ]),
  },
  component: ErrorCatalog,
  parameters: {
    docs: {
      description: {
        component: ErrorCatalog.__mdxr?.description,
      },
    },
  },
  title: "Components/ErrorCatalog",
} satisfies Meta<typeof ErrorCatalog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
