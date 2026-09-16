import type { Meta, StoryObj } from "@storybook/react-vite";

import { Prop, Props } from "../src/ui/props.js";

const meta = {
  component: Props,
  title: "Components/Props",
} satisfies Meta<typeof Props>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Props of="Step">
      <Prop name="status" type='"todo" | "doing" | "done" | "blocked"' required>
        Step marker state.
      </Prop>
      <Prop name="owner" type="string">
        Assignee handle, e.g. <code>@alice</code>.
      </Prop>
      <Prop name="effort" type='"xs" | "s" | "m" | "l" | "xl"' default='"m"'>
        T-shirt estimate.
      </Prop>
    </Props>
  ),
};

export const WithoutTitle: Story = {
  render: () => (
    <Props>
      <Prop name="path" type="string" required>
        File path relative to the document.
      </Prop>
    </Props>
  ),
};
