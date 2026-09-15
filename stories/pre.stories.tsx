import type { Meta, StoryObj } from "@storybook/react-vite";

import { Pre } from "../src/ui/pre.js";

const TS_SOURCE = `import { renderFile } from "./render.js";

const html = await renderFile("examples/plan.mdx");
await writeFile("out.html", html);
`;

const MERMAID_SOURCE = `graph LR
  A[plan.mdx] --> B[evaluate]
  B --> C[renderToStaticMarkup]
  C --> D[standalone HTML]
`;

const meta = {
  component: Pre,
  title: "Components/Pre",
} satisfies Meta<typeof Pre>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithFilename: Story = {
  args: { meta: 'title="src/render.ts"' },
  render: (args) => (
    <Pre {...args}>
      <code className="language-ts">{TS_SOURCE}</code>
    </Pre>
  ),
};

export const LanguageOnly: Story = {
  render: () => (
    <Pre>
      <code className="language-ts">{TS_SOURCE}</code>
    </Pre>
  ),
};

export const Mermaid: Story = {
  render: () => (
    <Pre>
      <code className="language-mermaid">{MERMAID_SOURCE}</code>
    </Pre>
  ),
};
