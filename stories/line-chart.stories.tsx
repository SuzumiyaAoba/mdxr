import type { Meta, StoryObj } from "@storybook/react-vite";

import { LineChart } from "../src/ui/line-chart.js";
import { Series } from "../src/ui/series.js";

const meta = {
  component: LineChart,
  title: "Components/LineChart",
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Latency: Story = {
  render: () => (
    <LineChart
      labels="Mon,Tue,Wed,Thu,Fri,Sat,Sun"
      title="p95 latency"
      unit="ms"
    >
      <Series name="api" values="120,118,132,125,110,98,102" />
      <Series name="edge" tone="emerald" values="60,58,64,70,55,48,50" />
    </LineChart>
  ),
};

export const AreaFill: Story = {
  render: () => (
    <LineChart
      area
      labels="Jan,Feb,Mar,Apr,May,Jun"
      title="monthly actives"
      unit="k"
    >
      <Series name="free" values="8,9.5,11,10.5,13,15" />
      <Series name="pro" tone="violet" values="2,2.4,3.1,3.8,4.5,5.2" />
    </LineChart>
  ),
};

export const DashedBaseline: Story = {
  render: () => (
    <LineChart labels="w1,w2,w3,w4" max="100" min="0" title="error budget">
      <Series name="actual" values="12,18,9,14" />
      <Series dash name="threshold" tone="red" values="20,20,20,20" />
    </LineChart>
  ),
};
