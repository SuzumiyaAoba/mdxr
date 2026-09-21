import type { Meta, StoryObj } from "@storybook/react-vite";

import { BundleReport } from "../../src/ui/semantic-diagrams.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        id: "app",
        name: "App",
      },
      {
        before: 70_000,
        gzip: 18_000,
        id: "ui",
        parent: "app",
        reason: "Document controls",
        value: 60_000,
      },
      {
        before: 35_000,
        gzip: 12_000,
        id: "core",
        parent: "app",
        reason: "Compiler",
        value: 40_000,
      },
    ]),
  },
  component: BundleReport,
  parameters: {
    docs: {
      description: {
        component: BundleReport.__mdxr?.description,
      },
    },
  },
  title: "Components/BundleReport",
} satisfies Meta<typeof BundleReport>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
