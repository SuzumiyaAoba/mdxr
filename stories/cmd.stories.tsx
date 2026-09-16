import type { Meta, StoryObj } from "@storybook/react-vite";

import { Cmd } from "../src/ui/cmd.js";

const meta = {
  component: Cmd,
  title: "Components/Cmd",
} satisfies Meta<typeof Cmd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InlineInText: Story = {
  render: () => (
    <p>
      Run <Cmd>pnpm build</Cmd> then <Cmd>rv render plan.mdx</Cmd>.
    </p>
  ),
};
