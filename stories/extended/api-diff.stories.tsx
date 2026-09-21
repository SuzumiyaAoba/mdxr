import type { Meta, StoryObj } from "@storybook/react-vite";

import { ApiDiff } from "../../src/ui/structured-diff.js";

const meta = {
  args: {
    after: JSON.stringify({
      description: "Identifier",
      type: "number",
    }),
    before: JSON.stringify({
      description: "Identifier",
      type: "string",
    }),
  },
  component: ApiDiff,
  parameters: {
    docs: {
      description: {
        component: ApiDiff.__mdxr?.description,
      },
    },
  },
  title: "Components/ApiDiff",
} satisfies Meta<typeof ApiDiff>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
