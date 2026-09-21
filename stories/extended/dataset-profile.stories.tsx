import type { Meta, StoryObj } from "@storybook/react-vite";

import { DatasetProfile } from "../../src/ui/evaluation-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        age: 21,
        id: "a",
        team: "A",
      },
      {
        age: null,
        id: "b",
        team: "B",
      },
      {
        age: 35,
        id: "c",
        team: "A",
      },
    ]),
  },
  component: DatasetProfile,
  parameters: {
    docs: {
      description: {
        component: DatasetProfile.__mdxr?.description,
      },
    },
  },
  title: "Components/DatasetProfile",
} satisfies Meta<typeof DatasetProfile>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
