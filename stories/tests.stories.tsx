import type { Meta, StoryObj } from "@storybook/react-vite";

import { Test, Tests } from "../src/ui/tests.js";

const meta = {
  component: Tests,
  title: "Components/Tests",
} satisfies Meta<typeof Tests>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Suite: Story = {
  render: () => (
    <Tests title="render.test.ts" tool="vitest">
      <Test name="renders markdown prose" status="pass" duration="12ms" />
      <Test
        file="tests/render.test.ts"
        lines="40-52"
        name="renders Callout"
        status="pass"
        duration="4ms"
      />
      <Test
        file="tests/render.test.ts"
        lines="96"
        name="rejects invalid props"
        status="fail"
        duration="802ms"
      >
        AssertionError: expected body to contain &quot;Invalid props&quot;
      </Test>
      <Test name="streams stdin" status="skip" />
      <Test name="todo: watch mode" status="todo" />
    </Tests>
  ),
};
