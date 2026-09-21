import type { Meta, StoryObj } from "@storybook/react-vite";

import { Ranking } from "../../src/ui/document-inputs.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        id: "speed",
        label: "Performance",
      },
      {
        id: "clarity",
        label: "Clarity",
      },
      {
        id: "cost",
        label: "Cost",
      },
    ]),
  },
  component: Ranking,
  parameters: {
    docs: {
      description: {
        component: Ranking.__mdxr?.description,
      },
    },
  },
  title: "Components/Ranking",
} satisfies Meta<typeof Ranking>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
