import type { Meta, StoryObj } from "@storybook/react-vite";

import { Meta as MetaRow, MetaItem } from "../src/ui/meta.js";

const meta = {
  args: {
    date: "2026-09-10",
    owner: "@suzumiyaaoba",
    updated: "2026-09-16",
    version: "v3",
  },
  component: MetaRow,
  title: "Components/Meta",
} satisfies Meta<typeof MetaRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Shorthand: Story = {};

export const CustomItems: Story = {
  args: {
    date: undefined,
    owner: undefined,
    updated: undefined,
    version: undefined,
  },
  render: () => (
    <MetaRow>
      <MetaItem label="Spec">RFC-042</MetaItem>
      <MetaItem label="Tracking">
        <a href="https://example.com">PROJ-123</a>
      </MetaItem>
    </MetaRow>
  ),
};
