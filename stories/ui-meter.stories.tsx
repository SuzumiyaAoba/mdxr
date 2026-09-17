import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Meter,
  MeterIndicator,
  MeterLabel,
  MeterTrack,
  MeterValue,
} from "../src/components/ui/meter.js";

const meta = {
  component: Meter,
  title: "Components/UI/Meter",
} satisfies Meta<typeof Meter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 75 },
  render: (args) => (
    <Meter className="w-80" {...args}>
      <div className="flex items-center justify-between gap-2">
        <MeterLabel>Storage usage</MeterLabel>
        <MeterValue />
      </div>
      <MeterTrack>
        <MeterIndicator />
      </MeterTrack>
    </Meter>
  ),
};

export const Bare: Story = {
  args: { value: 50 },
  render: (args) => <Meter className="w-80" {...args} />,
};

export const CustomRange: Story = {
  args: { max: 5, value: 3 },
  render: (args) => (
    <Meter className="w-80" {...args}>
      <div className="flex items-center justify-between gap-2">
        <MeterLabel>Rating</MeterLabel>
        <MeterValue>{(_formatted, value) => `${value} / 5`}</MeterValue>
      </div>
      <MeterTrack>
        <MeterIndicator />
      </MeterTrack>
    </Meter>
  ),
};
