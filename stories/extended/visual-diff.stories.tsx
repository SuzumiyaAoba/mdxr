import type { Meta, StoryObj } from "@storybook/react-vite";

import { VisualDiff } from "../../src/ui/document-media.js";

const meta = {
  args: {
    actual: "assets/after.svg",
    diff: "assets/diff.svg",
    expected: "assets/before.svg",
    mismatch: "0.02",
    threshold: "0.01",
  },
  component: VisualDiff,
  parameters: {
    docs: {
      description: {
        component: VisualDiff.__mdxr?.description,
      },
    },
  },
  title: "Components/VisualDiff",
} satisfies Meta<typeof VisualDiff>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
