import type { Meta, StoryObj } from "@storybook/react-vite";

import { ImageGallery } from "../../src/ui/document-media.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        alt: "Before layout",
        caption: "Before",
        src: "assets/before.svg",
      },
      {
        alt: "After layout",
        caption: "After",
        src: "assets/after.svg",
      },
    ]),
  },
  component: ImageGallery,
  parameters: {
    docs: {
      description: {
        component: ImageGallery.__mdxr?.description,
      },
    },
  },
  title: "Components/ImageGallery",
} satisfies Meta<typeof ImageGallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
