import type { Meta, StoryObj } from "@storybook/react-vite";

import { DeprecationTimeline } from "../../src/ui/reference-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        deprecated: "Deprecated",
        feature: "Feature",
        migration: "Migration",
        removal: "Removal",
        replacement: "Replacement",
      },
    ]),
  },
  component: DeprecationTimeline,
  parameters: {
    docs: {
      description: {
        component: DeprecationTimeline.__mdxr?.description,
      },
    },
  },
  title: "Components/DeprecationTimeline",
} satisfies Meta<typeof DeprecationTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
