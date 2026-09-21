import type { Meta, StoryObj } from "@storybook/react-vite";
import html from "virtual:mdxr-component/TableOfFigures";

import { TableOfFigures } from "../../src/ui/document-references.js";
import { DocumentPreview } from "./document-preview.js";

const meta = {
  component: TableOfFigures,
  parameters: {
    controls: {
      disable: true,
    },
    docs: {
      description: {
        component: TableOfFigures.__mdxr?.description,
        story:
          "This example uses the real MDX compiler to resolve inclusion, references and numbering.",
      },
      source: {
        code: "<TableOfFigures />\n\n<Figure src='assets/after.svg' id='listed-figure' caption='Listed figure'>\n\nFigure content.\n\n</Figure>",
        language: "mdx",
      },
    },
    layout: "fullscreen",
    mdxrDocument: true,
  },
  render: () => <DocumentPreview html={html} title="TableOfFigures example" />,
  title: "Components/TableOfFigures",
} satisfies Meta<typeof TableOfFigures>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
