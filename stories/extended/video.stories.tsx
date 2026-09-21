import type { Meta, StoryObj } from "@storybook/react-vite";

import { Video } from "../../src/ui/document-media.js";

const meta = {
  args: {
    captions: "assets/captions.vtt",
    poster: "assets/before.svg",
    src: "assets/example.webm",
  },
  component: Video,
  parameters: {
    docs: {
      description: {
        component: Video.__mdxr?.description,
      },
    },
  },
  title: "Components/Video",
} satisfies Meta<typeof Video>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
