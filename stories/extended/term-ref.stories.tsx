import type { Meta, StoryObj } from "@storybook/react-vite";
import html from "virtual:mdxr-component/TermRef";

import { TermRef } from "../../src/ui/document-references.js";
import { DocumentPreview } from "./document-preview.js";

const meta = {
  component: TermRef,
  parameters: {
    controls: {
      disable: true,
    },
    docs: {
      description: {
        component: TermRef.__mdxr?.description,
        story:
          "This example uses the real MDX compiler to resolve inclusion, references and numbering.",
      },
      source: {
        code: '<Glossary>\n<Term name="cache">Stored results reused for later requests.</Term>\n</Glossary>\n\nUse a <TermRef term="cache" />.',
        language: "mdx",
      },
    },
    layout: "fullscreen",
    mdxrDocument: true,
  },
  render: () => <DocumentPreview html={html} title="TermRef example" />,
  title: "Components/TermRef",
} satisfies Meta<typeof TermRef>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
