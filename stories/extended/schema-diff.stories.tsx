import type { Meta, StoryObj } from "@storybook/react-vite";

import { SchemaDiff } from "../../src/ui/structured-diff.js";

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
  component: SchemaDiff,
  parameters: {
    docs: {
      description: {
        component: SchemaDiff.__mdxr?.description,
      },
    },
  },
  title: "Components/SchemaDiff",
} satisfies Meta<typeof SchemaDiff>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
