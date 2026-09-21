import type { Meta, StoryObj } from "@storybook/react-vite";

import { SymbolOutline } from "../../src/ui/investigation-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        file: "File",
        kind: "Kind",
        lines: "Lines",
        name: "Example",
        parent: "Parent",
        signature: "Signature",
      },
    ]),
  },
  component: SymbolOutline,
  parameters: {
    docs: {
      description: {
        component: SymbolOutline.__mdxr?.description,
      },
    },
  },
  title: "Components/SymbolOutline",
} satisfies Meta<typeof SymbolOutline>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
