import type { Meta, StoryObj } from "@storybook/react-vite";

import { Bridge, Delta } from "../src/ui/bridge.js";

const meta = {
  component: Bridge,
  title: "Components/Bridge",
} satisfies Meta<typeof Bridge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Revenue: Story = {
  render: () => (
    <Bridge title="FY revenue bridge" unit="M$">
      <Delta name="FY24" total value="120" />
      <Delta name="new sales" note="+3 logos" value="48" />
      <Delta name="expansion" value="22" />
      <Delta name="churn" value="-15" />
      <Delta name="FY25" total value="175" />
    </Bridge>
  ),
};

export const Headcount: Story = {
  render: () => (
    <Bridge title="team size" unit="ppl">
      <Delta name="Jan" total value="18" />
      <Delta name="hires" value="6" />
      <Delta name="attrition" value="-3" />
      <Delta name="Jun" total value="21" />
    </Bridge>
  ),
};
