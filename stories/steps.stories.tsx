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

export const WithProgress: Story = {
  render: () => (
    <Steps progress>
      <Step status="done">MDX compile via evaluate()</Step>
      <Step status="done">Tailwind v4 runtime CSS generation</Step>
      <Step status="doing">rv catalog --json for agent discovery</Step>
      <Step status="todo">Watch-mode invalidation</Step>
      <Step>Implicit todo step (no status prop)</Step>
    </Steps>
  ),
};

export const WithChips: Story = {
  render: () => (
    <Steps>
      <Step status="doing" priority="p1" owner="@alice" due="2026-09-30">
        rv catalog --json for agent discovery
      </Step>
      <Step status="todo" effort="m" owner="Bob Tanaka">
        Watch-mode invalidation for custom components
      </Step>
      <Step status="blocked" priority="p0">
        Remote component registries
      </Step>
    </Steps>
  ),
};
