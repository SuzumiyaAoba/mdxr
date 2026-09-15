import type { Meta, StoryObj } from "@storybook/react-vite";

import { Step, Steps } from "../src/ui/steps.js";

const meta = {
  component: Steps,
  title: "Components/Steps",
} satisfies Meta<typeof Steps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Checklist: Story = {
  render: () => (
    <Steps>
      <Step status="done">MDX compile via evaluate()</Step>
      <Step status="done">Tailwind v4 runtime CSS generation</Step>
      <Step status="doing">rv catalog --json for agent discovery</Step>
      <Step status="todo">Watch-mode invalidation for custom components</Step>
      <Step status="blocked">Remote component registries</Step>
    </Steps>
  ),
};

export const SingleStep: Story = {
  render: () => (
    <Steps>
      <Step status="todo">
        <p>A step with a paragraph of rich content inside.</p>
      </Step>
    </Steps>
  ),
};
