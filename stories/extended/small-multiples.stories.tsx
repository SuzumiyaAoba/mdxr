import type { Meta, StoryObj } from "@storybook/react-vite";

import { DotPlot } from "../../src/ui/plot-dot-plot.js";
import { SmallMultiples } from "../../src/ui/small-multiples.js";

const meta = {
  args: {},
  component: SmallMultiples,
  parameters: {
    docs: {
      description: {
        component: SmallMultiples.__mdxr?.description,
      },
    },
  },
  render: (args) => (
    <SmallMultiples {...args}>
      <DotPlot
        data={JSON.stringify([
          {
            name: "A",
            value: 12,
          },
        ])}
        title="January"
      />
      <DotPlot
        data={JSON.stringify([
          {
            name: "A",
            value: 25,
          },
        ])}
        title="February"
      />
    </SmallMultiples>
  ),
  title: "Components/SmallMultiples",
} satisfies Meta<typeof SmallMultiples>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
