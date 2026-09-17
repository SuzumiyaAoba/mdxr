import type { Meta, StoryObj } from "@storybook/react-vite";

import { Req, Reqs } from "../src/ui/req.js";

const meta = {
  component: Reqs,
  title: "Components/Reqs",
} satisfies Meta<typeof Reqs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Reqs>
      <Req id="REQ-1" status="done">
        MDX documents render to standalone HTML.
      </Req>
      <Req id="REQ-2" status="doing">
        Line-level code annotations.
      </Req>
      <Req id="AC-1" status="todo">
        `mdxr catalog` lists every built-in.
      </Req>
      <Req id="AC-2" status="blocked">
        Remote registries.
      </Req>
    </Reqs>
  ),
};
