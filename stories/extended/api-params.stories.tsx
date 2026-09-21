import type { Meta, StoryObj } from "@storybook/react-vite";

import { ApiParams } from "../../src/ui/reference-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        constraints: "Constraints",
        default: "Default",
        description: "Review the result before release.",
        example: "Example",
        in: "In",
        name: "Example",
        required: "Required",
        type: "Type",
      },
    ]),
  },
  component: ApiParams,
  parameters: {
    docs: {
      description: {
        component: ApiParams.__mdxr?.description,
      },
    },
  },
  title: "Components/ApiParams",
} satisfies Meta<typeof ApiParams>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
