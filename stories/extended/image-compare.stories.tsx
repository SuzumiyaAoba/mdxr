import type { Meta, StoryObj } from "@storybook/react-vite";

import { ImageCompare } from "../../src/ui/document-media.js";

const meta = {
  args: {
    after: "assets/after.svg",
    afterAlt: "After layout",
    before: "assets/before.svg",
    beforeAlt: "Before layout",
  },
  component: ImageCompare,
  parameters: {
    docs: {
      description: {
        component: ImageCompare.__mdxr?.description,
      },
    },
  },
  title: "Components/ImageCompare",
} satisfies Meta<typeof ImageCompare>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
