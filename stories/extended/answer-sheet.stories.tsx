import type { Meta, StoryObj } from "@storybook/react-vite";

import { Ask, Question } from "../../src/ui/ask.js";
import { AnswerSheet } from "../../src/ui/document-inputs.js";

const meta = {
  args: {},
  component: AnswerSheet,
  parameters: {
    docs: {
      description: {
        component: AnswerSheet.__mdxr?.description,
      },
    },
  },
  render: (args) => (
    <AnswerSheet {...args}>
      <Ask title="Project">
        <Question name="project" type="text" label="Project name" />
        <Question name="ready" type="toggle" label="Ready" />
      </Ask>
    </AnswerSheet>
  ),
  title: "Components/AnswerSheet",
} satisfies Meta<typeof AnswerSheet>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
