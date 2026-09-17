import type { Meta, StoryObj } from "@storybook/react-vite";

import { Span, Waterfall } from "../src/ui/waterfall.js";

const meta = {
  component: Waterfall,
  title: "Components/Waterfall",
} satisfies Meta<typeof Waterfall>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RequestTrace: Story = {
  render: () => (
    <Waterfall title="GET /api/users" unit="ms">
      <Span duration="3ms" name="route match" start="0" />
      <Span duration="18ms" name="auth" note="token verify" start="3" />
      <Span duration="120ms" name="db query" note="users + roles" start="21" />
      <Span duration="9ms" name="serialize" start="141" />
      <Span duration="2ms" name="respond" start="150" />
    </Waterfall>
  ),
};

export const WithTotalOverride: Story = {
  render: () => (
    <Waterfall title="budget 400ms" total="400" unit="ms">
      <Span duration="40ms" name="preflight" />
      <Span duration="120ms" name="upload" start="40" />
    </Waterfall>
  ),
};
