import type { Meta, StoryObj } from "@storybook/react-vite";

import { JourneyMap } from "../../src/ui/diagrams-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        action: "Run the verification suite",
        improvement: "Improvement",
        pain: "Pain",
        stage: "Stage",
        touchpoint: "Touchpoint",
      },
    ]),
  },
  component: JourneyMap,
  parameters: {
    docs: {
      description: {
        component: JourneyMap.__mdxr?.description,
      },
    },
  },
  title: "Components/JourneyMap",
} satisfies Meta<typeof JourneyMap>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
