import type { Meta, StoryObj } from "@storybook/react-vite";

import { SymbolRef } from "../src/ui/symbol-ref.js";

const meta = {
  args: { kind: "fn", name: "mdxToHtml" },
  component: SymbolRef,
  title: "Components/SymbolRef",
} satisfies Meta<typeof SymbolRef>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Function: Story = {};

export const WithLocation: Story = {
  args: { lines: "70-106", path: "src/mdx.ts" },
};

export const TypeKind: Story = {
  args: { kind: "type", name: "CatalogEntry", path: "src/catalog.ts" },
};

export const InlineInText: Story = {
  render: () => (
    <p>
      The pipeline entry is{" "}
      <SymbolRef kind="fn" name="mdxToHtml" path="src/mdx.ts" /> which returns{" "}
      <SymbolRef kind="interface" name="MdxResult" />.
    </p>
  ),
};
