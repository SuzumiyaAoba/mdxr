import type { Meta, StoryObj } from "@storybook/react-vite";

import { ConfigReference } from "../../src/ui/reference-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        default: "Default",
        description: "Review the result before release.",
        env: "Env",
        flag: "Flag",
        key: "Key",
        precedence: "Precedence",
        type: "Type",
      },
    ]),
  },
  component: ConfigReference,
  parameters: {
    docs: {
      description: {
        component: ConfigReference.__mdxr?.description,
      },
    },
  },
  title: "Components/ConfigReference",
} satisfies Meta<typeof ConfigReference>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
