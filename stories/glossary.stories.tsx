import type { Meta, StoryObj } from "@storybook/react-vite";

import { Glossary, Term } from "../src/ui/glossary.js";

const meta = {
  component: Glossary,
  title: "Components/Glossary",
} satisfies Meta<typeof Glossary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Glossary>
      <Term name="mdast">
        Markdown abstract syntax tree — the remark model.
      </Term>
      <Term name="hast">HTML abstract syntax tree — the rehype model.</Term>
      <Term name="vfile">
        Virtual file carrying path, value and messages through the pipeline.
      </Term>
    </Glossary>
  ),
};
