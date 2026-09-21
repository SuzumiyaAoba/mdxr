import type { Meta, StoryObj } from "@storybook/react-vite";
import html from "virtual:mdxr-component/CrossRef";

import { CrossRef } from "../../src/ui/document-references.js";
import { DocumentPreview } from "./document-preview.js";

const meta = {
  component: CrossRef,
  parameters: {
    controls: {
      disable: true,
    },
    docs: {
      description: {
        component: CrossRef.__mdxr?.description,
        story:
          "This example uses the real MDX compiler to resolve inclusion, references and numbering.",
      },
      source: {
        code: "See <CrossRef target=\"reference-figure\" />.\n\n<Figure src='assets/before.svg' id='reference-figure' caption='Document rendering'>\n\nAn example figure.\n\n</Figure>",
        language: "mdx",
      },
    },
    layout: "fullscreen",
    mdxrDocument: true,
  },
  render: () => <DocumentPreview html={html} title="CrossRef example" />,
  title: "Components/CrossRef",
} satisfies Meta<typeof CrossRef>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
