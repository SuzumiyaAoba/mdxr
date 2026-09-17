import type { Meta, StoryObj } from "@storybook/react-vite";

import { Terminal } from "../src/ui/terminal.js";

const meta = {
  component: Terminal,
  title: "Components/Terminal",
} satisfies Meta<typeof Terminal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Command: Story = {
  render: () => (
    <Terminal cmd="rg 'evaluate' src/ --count" exit="0" title="grep evidence">
      {"src/mdx.ts: 3\nsrc/render.ts: 1"}
    </Terminal>
  ),
};

export const Failed: Story = {
  render: () => (
    <Terminal cmd="pnpm test" exit="1" title="test run">
      {
        "FAIL  tests/render.test.ts\n  ✗ renders markdown prose\n\n1 failed, 41 passed"
      }
    </Terminal>
  ),
};

export const Session: Story = {
  render: () => (
    <Terminal title="session">
      {
        "$ rg 'renderFile' src/\nsrc/render.ts:12:export const renderFile =\n$ pnpm build\n✓ built in 1.2s"
      }
    </Terminal>
  ),
};
