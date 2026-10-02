import type { Meta, StoryObj } from "@storybook/react-vite";
import html from "virtual:doc-component/DocumentLink";

import { DocumentLink } from "../../src/ui/document-references.js";
import { DocumentPreview } from "./document-preview.js";

const meta = {
  component: DocumentLink,
  parameters: {
    controls: { disable: true },
    docDocument: true,
    docs: {
      description: {
        component: DocumentLink.__mdxr?.description,
        story:
          "The real MDX compiler bundles the linked document so it can open without a server.",
      },
      source: {
        code: '<DocumentLink path="../../tests/fixtures/extended-include.mdx" label="Open shared context" section="shared-context" />',
        language: "mdx",
      },
    },
    layout: "fullscreen",
  },
  render: () => (
    <DocumentPreview html={html} title="DocumentLink example" allowPopups />
  ),
  title: "Components/DocumentLink",
} satisfies Meta<typeof DocumentLink>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
