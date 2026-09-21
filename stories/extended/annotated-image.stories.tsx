import type { Meta, StoryObj } from "@storybook/react-vite";

import { AnnotatedImage } from "../../src/ui/document-media.js";

const meta = {
  args: {
    alt: "Example navigation layout",
    data: JSON.stringify([
      {
        height: 35,
        label: "Navigation",
        note: "Persistent navigation area.",
        width: 30,
        x: 15,
        y: 25,
      },
    ]),
    src: "assets/after.svg",
  },
  component: AnnotatedImage,
  parameters: {
    docs: {
      description: {
        component: AnnotatedImage.__mdxr?.description,
      },
    },
  },
  title: "Components/AnnotatedImage",
} satisfies Meta<typeof AnnotatedImage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
