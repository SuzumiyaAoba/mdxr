import type { Meta, StoryObj } from "@storybook/react-vite";

import { Json } from "../src/ui/json.js";

const SAMPLE = JSON.stringify({
  active: true,
  meta: { retries: 3, tags: ["agent", "render"] },
  name: "mdxr",
  result: null,
  stats: { files: 12, ratio: 0.75 },
});

const meta = {
  component: Json,
  title: "Components/Json",
} satisfies Meta<typeof Json>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {
  render: () => <Json title="tool result" value={SAMPLE} />,
};

export const Collapsed: Story = {
  render: () => <Json open="false" title="tool result" value={SAMPLE} />,
};

export const ScalarRoot: Story = {
  render: () => <Json value='"just a string"' />,
};
