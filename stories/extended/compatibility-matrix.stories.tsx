import type { Meta, StoryObj } from "@storybook/react-vite";

import { CompatibilityMatrix } from "../../src/ui/reference-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        notes: "Reviewed with the team.",
        platform: "Platform",
        runtime: "Runtime",
        status: "open",
        version: "1.2.0",
      },
    ]),
  },
  component: CompatibilityMatrix,
  parameters: {
    docs: {
      description: {
        component: CompatibilityMatrix.__mdxr?.description,
      },
    },
  },
  title: "Components/CompatibilityMatrix",
} satisfies Meta<typeof CompatibilityMatrix>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
