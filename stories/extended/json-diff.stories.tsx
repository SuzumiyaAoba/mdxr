import type { Meta, StoryObj } from "@storybook/react-vite";

import { JsonDiff } from "../../src/ui/structured-diff.js";

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
  component: JsonDiff,
  parameters: {
    docs: {
      description: {
        component: JsonDiff.__mdxr?.description,
      },
    },
  },
  title: "Components/JsonDiff",
} satisfies Meta<typeof JsonDiff>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
