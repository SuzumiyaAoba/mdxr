import type { Meta, StoryObj } from "@storybook/react-vite";

import { PdfPreview } from "../../src/ui/document-media.js";

const meta = {
  args: {
    height: "300",
    page: "1",
    src: "assets/example.pdf",
    title: "Example report",
  },
  component: PdfPreview,
  parameters: {
    docs: {
      description: {
        component: PdfPreview.__mdxr?.description,
      },
    },
  },
  title: "Components/PdfPreview",
} satisfies Meta<typeof PdfPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
