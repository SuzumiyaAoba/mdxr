import type { Meta, StoryObj } from "@storybook/react-vite";

import { File, Files } from "../src/ui/files.js";

const meta = {
  component: Files,
  title: "Components/Files",
} satisfies Meta<typeof Files>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RelatedFiles: Story = {
  render: () => (
    <Files title="Files involved">
      <File path="src/mdx.ts" kind="entry" lines="70-106">
        Pipeline entry — compiles MDX to HTML.
      </File>
      <File path="src/render.ts" kind="core">
        Assembles the document shell and inlines CSS.
      </File>
      <File path="src/define.ts" kind="types">
        Component contract and prop validation.
      </File>
      <File path="rv.config.ts" kind="config" />
      <File path="tests/render.test.ts" kind="test" />
      <File path="dist/index.mjs" kind="generated" />
      <File path="src/custom/handler.ts" kind="middleware">
        Unknown roles render as a neutral chip.
      </File>
    </Files>
  ),
};

export const NoTitle: Story = {
  render: () => (
    <Files>
      <File path="src/cli.ts" kind="entry" />
      <File path="src/mdx.ts" />
    </Files>
  ),
};
