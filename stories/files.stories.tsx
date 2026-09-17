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
      <File path="mdxr.config.ts" kind="config" />
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

export const FileTypeIcons: Story = {
  render: () => (
    <Files title="Icons picked from file name / extension">
      <File path="src/app.tsx" />
      <File path="main.py" />
      <File path="lib.rs" />
      <File path="main.go" />
      <File path="styles.scss" />
      <File path="package.json" />
      <File path="pnpm-lock.yaml" />
      <File path="tsconfig.json" />
      <File path="Dockerfile" />
      <File path=".env.local" />
      <File path=".gitignore" />
      <File path="README.md" />
      <File path="app.test.ts" />
      <File path="vite.config.ts" />
      <File path="data.csv" />
      <File path="logo.svg" />
      <File path="archive.zip" />
      <File path="LICENSE" />
      <File path="unknown.xyz123" />
    </Files>
  ),
};
