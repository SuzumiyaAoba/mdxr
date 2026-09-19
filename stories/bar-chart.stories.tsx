import type { Meta, StoryObj } from "@storybook/react-vite";

import { Bar, BarChart } from "../src/ui/bar-chart.js";

const meta = {
  component: BarChart,
  title: "Components/BarChart",
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Quarterly: Story = {
  render: () => (
    <BarChart title="deploys per quarter" unit="deploys">
      <Bar name="Q1" value="18" />
      <Bar name="Q2" value="26" note="launch" />
      <Bar name="Q3" value="22" />
      <Bar name="Q4" tone="emerald" value="34" />
    </BarChart>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <BarChart direction="horizontal" title="pkg downloads" unit="/wk">
      <Bar name="core" value="1200" />
      <Bar name="cli" value="860" />
      <Bar name="docs" value="240" />
      <Bar name="experimental plugins" value="95" />
    </BarChart>
  ),
};

export const GroupedSeries: Story = {
  render: () => (
    <BarChart
      series="this year,last year"
      title="response time by endpoint"
      unit="ms"
    >
      <Bar name="/users" values="42,58" />
      <Bar name="/search" values="120,210" />
      <Bar name="/export" values="380,460" />
    </BarChart>
  ),
};

export const Stacked: Story = {
  render: () => (
    <BarChart
      series="web,ios,android"
      stacked
      title="signups by platform"
      unit="users"
    >
      <Bar name="Mon" values="30,12,18" />
      <Bar name="Tue" values="42,20,25" />
      <Bar name="Wed" values="35,18,22" />
    </BarChart>
  ),
};
