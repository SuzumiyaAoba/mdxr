import type { Meta, StoryObj } from "@storybook/react-vite";

import { TestMatrix } from "../../src/ui/quality-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        os: "linux",
        runtime: "22",
        status: "pass",
      },
    ]),
    options: JSON.stringify({
      axes: {
        os: ["linux", "mac"],
        runtime: ["22", "24"],
      },
    }),
  },
  component: TestMatrix,
  parameters: {
    docs: {
      description: {
        component: TestMatrix.__mdxr?.description,
      },
    },
  },
  title: "Components/TestMatrix",
} satisfies Meta<typeof TestMatrix>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
