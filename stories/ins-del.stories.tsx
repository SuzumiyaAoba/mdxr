import type { Meta, StoryObj } from "@storybook/react-vite";

import { Del, Ins } from "../src/ui/ins-del.js";

const meta = {
  component: Ins,
  title: "Components/InsDel",
} satisfies Meta<typeof Ins>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InlineEdits: Story = {
  render: () => (
    <p className="text-sm leading-relaxed">
      The compiler <Del>concatenates strings</Del>
      <Ins>streams tokens</Ins> and <Del>always</Del>
      <Ins>optionally</Ins> minifies the output.
    </p>
  ),
};

export const WithTitles: Story = {
  render: () => (
    <p className="text-sm leading-relaxed">
      Rename <Del title="old name">renderFile</Del> to{" "}
      <Ins title="new name">renderDocument</Ins>.
    </p>
  ),
};
