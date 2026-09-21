import type { Meta, StoryObj } from "@storybook/react-vite";

import { ActionItems } from "../../src/ui/planning-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        acceptance: "Acceptance",
        action: "Run the verification suite",
        due: "Due",
        evidence: "tests/release.test.ts",
        owner: "Platform",
        status: "open",
      },
    ]),
  },
  component: ActionItems,
  parameters: {
    docs: {
      description: {
        component: ActionItems.__mdxr?.description,
      },
    },
  },
  title: "Components/ActionItems",
} satisfies Meta<typeof ActionItems>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
