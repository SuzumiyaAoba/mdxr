import type { Meta, StoryObj } from "@storybook/react-vite";
import html from "virtual:doc-component/NumberedEquation";

import { NumberedEquation } from "../../src/ui/document-references.js";
import { DocumentPreview } from "./document-preview.js";

const meta = {
  component: NumberedEquation,
  parameters: {
    controls: {
      disable: true,
    },
    docDocument: true,
    docs: {
      description: {
        component: NumberedEquation.__mdxr?.description,
        story:
          "This example uses the real MDX compiler to resolve inclusion, references and numbering.",
      },
      source: {
        code: "<NumberedEquation id='velocity'>\n\n$$\nv = d / t\n$$\n\n</NumberedEquation>\n\nSee <CrossRef target=\"velocity\" />.",
        language: "mdx",
      },
    },
    layout: "fullscreen",
  },
  render: () => (
    <DocumentPreview html={html} title="NumberedEquation example" />
  ),
  title: "Components/NumberedEquation",
} satisfies Meta<typeof NumberedEquation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
