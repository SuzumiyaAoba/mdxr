import type { Meta, StoryObj } from "@storybook/react-vite";

import { DownloadData } from "../../src/ui/data-table.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        id: "alpha",
        name: "Alpha",
        status: "ready",
        value: 20,
      },
      {
        id: "beta",
        name: "Beta",
        status: "pending",
        value: 10,
      },
      {
        id: "gamma",
        name: "Gamma",
        status: "ready",
        value: 30,
      },
    ]),
    filename: "example",
  },
  component: DownloadData,
  parameters: {
    docs: {
      description: {
        component: DownloadData.__mdxr?.description,
      },
    },
  },
  title: "Components/DownloadData",
} satisfies Meta<typeof DownloadData>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
