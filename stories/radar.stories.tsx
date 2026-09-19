import type { Meta, StoryObj } from "@storybook/react-vite";

import { Radar } from "../src/ui/radar.js";
import { Series } from "../src/ui/series.js";

const meta = {
  component: Radar,
  title: "Components/Radar",
} satisfies Meta<typeof Radar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TeamProfile: Story = {
  render: () => (
    <Radar axes="Perf,DX,Tests,Docs,Security" title="service health">
      <Series name="api" values="80,65,90,40,70" />
      <Series name="web" tone="emerald" values="60,85,55,70,60" />
    </Radar>
  ),
};

export const FixedScale: Story = {
  render: () => (
    <Radar axes="Speed,Power,Range,Cost" max="10" title="prototype eval">
      <Series name="v2" tone="violet" values="7,8,4,9" />
      <Series dash name="v1" values="5,6,6,7" />
    </Radar>
  ),
};
