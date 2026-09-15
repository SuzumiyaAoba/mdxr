import type { Meta, StoryObj } from "@storybook/react-vite";

import { FileRef } from "../src/ui/file-ref.js";

const meta = {
  args: { path: "src/render.ts" },
  component: FileRef,
  title: "Components/FileRef",
} satisfies Meta<typeof FileRef>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PathOnly: Story = {};

export const WithLines: Story = {
  args: { lines: "93-163" },
};

export const InlineInText: Story = {
  render: () => (
    <p>
      The entry point lives in <FileRef path="src/render.ts" lines="93-163" />{" "}
      and calls <code>mdxToHtml</code>.
    </p>
  ),
};
