import type { Meta, StoryObj } from "@storybook/react-vite";
import html from "virtual:mdxr-component/Cite";

import { Cite } from "../../src/ui/document-references.js";
import { DocumentPreview } from "./document-preview.js";

const meta = {
  component: Cite,
  parameters: {
    controls: {
      disable: true,
    },
    docs: {
      description: {
        component: Cite.__mdxr?.description,
        story:
          "This example uses the real MDX compiler to resolve inclusion, references and numbering.",
      },
      source: {
        code: "A documented claim <Cite source=\"manual\" />.\n\n<Sources>\n\n<Source id='manual' href='https://example.com/manual' title='Example manual' author='Example team' published='2026-09-01' />\n\n</Sources>",
        language: "mdx",
      },
    },
    layout: "fullscreen",
    mdxrDocument: true,
  },
  render: () => <DocumentPreview html={html} title="Cite example" />,
  title: "Components/Cite",
} satisfies Meta<typeof Cite>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
