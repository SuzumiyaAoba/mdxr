import type { Meta, StoryObj } from "@storybook/react-vite";

import { Limitations } from "../../src/ui/evidence-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        consequence: "Consequence",
        followup: "Followup",
        limitation: "Limitation",
        scope: "Renderer",
      },
    ]),
  },
  component: Limitations,
  parameters: {
    docs: {
      description: {
        component: Limitations.__mdxr?.description,
      },
    },
  },
  title: "Components/Limitations",
} satisfies Meta<typeof Limitations>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
