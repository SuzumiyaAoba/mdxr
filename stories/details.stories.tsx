import type { Meta, StoryObj } from "@storybook/react-vite";

import { Details } from "../src/ui/details.js";

const meta = {
  component: Details,
  title: "Components/Details",
} satisfies Meta<typeof Details>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  render: () => (
    <Details summary="検討したが却下した案">
      <p>一括書き換え — ロールバック経路がないため。</p>
    </Details>
  ),
};

export const Open: Story = {
  render: () => (
    <Details open summary="採用した理由">
      <p>既存パイプラインを再利用でき、移行リスクが最小。</p>
    </Details>
  ),
};
