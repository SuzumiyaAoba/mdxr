import type { Meta, StoryObj } from "@storybook/react-vite";

import { Figure } from "../src/ui/figure.js";

const meta = {
  args: {
    alt: "Rendered plan document",
    caption: "Fig 1 — rendered output",
    src: "https://placehold.co/640x320",
  },
  component: Figure,
  title: "Components/Figure",
} satisfies Meta<typeof Figure>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithCaption: Story = {};

export const NoCaption: Story = {
  args: { caption: undefined },
};
