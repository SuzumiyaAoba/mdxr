import type { Meta, StoryObj } from "@storybook/react-vite";

import { PromptTemplate } from "../../src/ui/document-inputs.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        description: "Subject of the summary.",
        label: "Topic",
        name: "topic",
        value: "rendering",
      },
    ]),
    template: "Summarize {{topic}} in three sentences.",
  },
  component: PromptTemplate,
  parameters: {
    docs: {
      description: {
        component: PromptTemplate.__mdxr?.description,
      },
    },
  },
  title: "Components/PromptTemplate",
} satisfies Meta<typeof PromptTemplate>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
