import type { Meta, StoryObj } from "@storybook/react-vite";

import { Assumptions } from "../../src/ui/evidence-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        assumption: "Assumption",
        evidence: "tests/release.test.ts",
        owner: "Platform",
        revisit: "Revisit",
        status: "open",
      },
    ]),
  },
  component: Assumptions,
  parameters: {
    docs: {
      description: {
        component: Assumptions.__mdxr?.description,
      },
    },
  },
  title: "Components/Assumptions",
} satisfies Meta<typeof Assumptions>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
