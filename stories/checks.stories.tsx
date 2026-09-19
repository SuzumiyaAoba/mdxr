import type { Meta, StoryObj } from "@storybook/react-vite";

import { Check, Checks } from "../src/ui/checks.js";

const meta = {
  component: Checks,
  title: "Components/Checks",
} satisfies Meta<typeof Checks>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pipeline: Story = {
  render: () => (
    <Checks context="a1b2c3d" title="CI — main">
      <Check duration="32s" name="lint" required status="pass" />
      <Check duration="1m48s" name="typecheck" required status="pass" />
      <Check duration="4m12s" name="test" required status="fail">
        AssertionError in render.test.ts — expected body to contain
        &quot;Checks&quot;
      </Check>
      <Check duration="58s" name="build-storybook" status="running" />
      <Check name="deploy-preview" status="pending" />
      <Check name="visual-regression" status="skip" />
    </Checks>
  ),
};

export const AllPass: Story = {
  render: () => (
    <Checks title="Release gate" context="v0.2.0">
      <Check duration="12s" name="pnpm check" status="pass" />
      <Check duration="41s" name="pnpm test" status="pass" />
      <Check duration="2m04s" name="pnpm build" status="pass" />
    </Checks>
  ),
};
