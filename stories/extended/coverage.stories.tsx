import type { Meta, StoryObj } from "@storybook/react-vite";

import { Coverage } from "../../src/ui/quality-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        covered: 88,
        name: "Parser",
        total: 100,
      },
    ]),
  },
  component: Coverage,
  parameters: {
    docs: {
      description: {
        component: Coverage.__mdxr?.description,
      },
    },
  },
  title: "Components/Coverage",
} satisfies Meta<typeof Coverage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
