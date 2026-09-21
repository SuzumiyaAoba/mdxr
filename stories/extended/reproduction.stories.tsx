import type { Meta, StoryObj } from "@storybook/react-vite";

import { Reproduction } from "../../src/ui/investigation-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        action: "Run the verification suite",
        actual: "Ready",
        environment: "staging",
        expected: "Ready",
        prerequisite: "Prerequisite",
        step: "Step",
      },
    ]),
  },
  component: Reproduction,
  parameters: {
    docs: {
      description: {
        component: Reproduction.__mdxr?.description,
      },
    },
  },
  title: "Components/Reproduction",
} satisfies Meta<typeof Reproduction>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
