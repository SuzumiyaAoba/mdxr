import type { Meta, StoryObj } from "@storybook/react-vite";
import html from "virtual:mdxr-component/Theorem";

import { Theorem } from "../../src/ui/document-references.js";
import { DocumentPreview } from "./document-preview.js";

const meta = {
  component: Theorem,
  parameters: {
    controls: {
      disable: true,
    },
    docs: {
      description: {
        component: Theorem.__mdxr?.description,
        story:
          "This example uses the real MDX compiler to resolve inclusion, references and numbering.",
      },
      source: {
        code: "<Theorem id='even-sum' title='Even sums'>\n\nThe sum of two even integers is even.\n\n</Theorem>\n\n<Proof id='even-proof'>\n\nWrite the integers as $2a$ and $2b$. Their sum is $2(a+b)$.\n\n</Proof>",
        language: "mdx",
      },
    },
    layout: "fullscreen",
    mdxrDocument: true,
  },
  render: () => <DocumentPreview html={html} title="Theorem example" />,
  title: "Components/Theorem",
} satisfies Meta<typeof Theorem>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
