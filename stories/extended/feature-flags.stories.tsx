import type { Meta, StoryObj } from "@storybook/react-vite";

import { FeatureFlags } from "../../src/ui/operations-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        condition: "Condition",
        enabled: "Enabled",
        environment: "staging",
        flag: "Flag",
        owner: "Platform",
        retire: "Retire",
      },
    ]),
  },
  component: FeatureFlags,
  parameters: {
    docs: {
      description: {
        component: FeatureFlags.__mdxr?.description,
      },
    },
  },
  title: "Components/FeatureFlags",
} satisfies Meta<typeof FeatureFlags>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
