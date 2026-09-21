import type { Meta, StoryObj } from "@storybook/react-vite";

import { ConfusionMatrix } from "../../src/ui/plot-confusion-matrix.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        actual: "yes",
        count: 40,
        predicted: "yes",
      },
      {
        actual: "yes",
        count: 10,
        predicted: "no",
      },
      {
        actual: "no",
        count: 5,
        predicted: "yes",
      },
      {
        actual: "no",
        count: 45,
        predicted: "no",
      },
    ]),
  },
  component: ConfusionMatrix,
  parameters: {
    docs: {
      description: {
        component: ConfusionMatrix.__mdxr?.description,
      },
    },
  },
  title: "Components/ConfusionMatrix",
} satisfies Meta<typeof ConfusionMatrix>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
