import type { Meta, StoryObj } from "@storybook/react-vite";

import { ConfigDiff } from "../../src/ui/structured-diff.js";

const meta = {
  args: {
    after: JSON.stringify([
      {
        name: "defaults",
        values: {
          retries: 2,
        },
      },
      {
        name: "production",
        values: {
          retries: 4,
        },
      },
    ]),
    before: JSON.stringify([
      {
        name: "defaults",
        values: {
          retries: 2,
        },
      },
    ]),
  },
  component: ConfigDiff,
  parameters: {
    docs: {
      description: {
        component: ConfigDiff.__mdxr?.description,
      },
    },
  },
  title: "Components/ConfigDiff",
} satisfies Meta<typeof ConfigDiff>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
