import type { Meta, StoryObj } from "@storybook/react-vite";

import { DatasetDiff } from "../../src/ui/structured-diff.js";

const meta = {
  args: {
    after: JSON.stringify([
      {
        id: "new",
        value: 4,
      },
      {
        id: "one",
        value: 5,
      },
    ]),
    before: JSON.stringify([
      {
        id: "one",
        value: 2,
      },
      {
        id: "old",
        value: 3,
      },
    ]),
  },
  component: DatasetDiff,
  parameters: {
    docs: {
      description: {
        component: DatasetDiff.__mdxr?.description,
      },
    },
  },
  title: "Components/DatasetDiff",
} satisfies Meta<typeof DatasetDiff>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
