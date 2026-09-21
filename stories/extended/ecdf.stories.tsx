import type { Meta, StoryObj } from "@storybook/react-vite";

import { ECDF } from "../../src/ui/plot-ecdf.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        values: [1, 1, 2, 3, 4, 5, 8],
      },
    ]),
  },
  component: ECDF,
  parameters: {
    docs: {
      description: {
        component: ECDF.__mdxr?.description,
      },
    },
  },
  title: "Components/ECDF",
} satisfies Meta<typeof ECDF>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
