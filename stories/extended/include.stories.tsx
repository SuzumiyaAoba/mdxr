import type { Meta, StoryObj } from "@storybook/react-vite";
import html from "virtual:mdxr-component/Include";

import { Include } from "../../src/ui/document-references.js";
import { DocumentPreview } from "./document-preview.js";

const meta = {
  component: Include,
  parameters: {
    controls: {
      disable: true,
    },
    docs: {
      description: {
        component: Include.__mdxr?.description,
        story:
          "This example uses the real MDX compiler to resolve inclusion, references and numbering.",
      },
      source: {
        code: "<Include path='../../tests/fixtures/extended-include.mdx' section='shared-context' />",
        language: "mdx",
      },
    },
    layout: "fullscreen",
    mdxrDocument: true,
  },
  render: () => <DocumentPreview html={html} title="Include example" />,
  title: "Components/Include",
} satisfies Meta<typeof Include>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
