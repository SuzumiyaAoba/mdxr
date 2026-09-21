import type { Meta, StoryObj } from "@storybook/react-vite";

import { RACI } from "../../src/ui/planning-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        accountable: "Accountable",
        consulted: "Consulted",
        informed: "Informed",
        responsible: "Responsible",
        task: "Task",
      },
    ]),
  },
  component: RACI,
  parameters: {
    docs: {
      description: {
        component: RACI.__mdxr?.description,
      },
    },
  },
  title: "Components/RACI",
} satisfies Meta<typeof RACI>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
