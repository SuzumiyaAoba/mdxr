import type { Meta, StoryObj } from "@storybook/react-vite";

import { CohortTable } from "../../src/ui/plot-cohort-table.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        cohort: "July",
        period: "Week 1",
        retained: 80,
        total: 100,
      },
      {
        cohort: "July",
        period: "Week 2",
        retained: 60,
        total: 100,
      },
      {
        cohort: "August",
        period: "Week 1",
        retained: 90,
        total: 100,
      },
    ]),
  },
  component: CohortTable,
  parameters: {
    docs: {
      description: {
        component: CohortTable.__mdxr?.description,
      },
    },
  },
  title: "Components/CohortTable",
} satisfies Meta<typeof CohortTable>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
