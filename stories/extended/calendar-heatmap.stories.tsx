import type { Meta, StoryObj } from "@storybook/react-vite";

import { CalendarHeatmap } from "../../src/ui/plot-calendar-heatmap.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        date: "2026-09-01",
        value: 1,
      },
      {
        date: "2026-09-02",
        value: 2,
      },
      {
        date: "2026-09-03",
        value: 3,
      },
      {
        date: "2026-09-04",
        value: 4,
      },
      {
        date: "2026-09-05",
        value: 5,
      },
      {
        date: "2026-09-06",
        value: 6,
      },
      {
        date: "2026-09-07",
        value: 0,
      },
      {
        date: "2026-09-08",
        value: 1,
      },
      {
        date: "2026-09-09",
        value: 2,
      },
      {
        date: "2026-09-10",
        value: 3,
      },
      {
        date: "2026-09-11",
        value: 4,
      },
      {
        date: "2026-09-12",
        value: 5,
      },
      {
        date: "2026-09-13",
        value: 6,
      },
      {
        date: "2026-09-14",
        value: 0,
      },
      {
        date: "2026-09-15",
        value: 1,
      },
      {
        date: "2026-09-16",
        value: 2,
      },
      {
        date: "2026-09-17",
        value: 3,
      },
      {
        date: "2026-09-18",
        value: 4,
      },
      {
        date: "2026-09-19",
        value: 5,
      },
      {
        date: "2026-09-20",
        value: 6,
      },
      {
        date: "2026-09-21",
        value: 0,
      },
    ]),
  },
  component: CalendarHeatmap,
  parameters: {
    docs: {
      description: {
        component: CalendarHeatmap.__mdxr?.description,
      },
    },
  },
  title: "Components/CalendarHeatmap",
} satisfies Meta<typeof CalendarHeatmap>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
