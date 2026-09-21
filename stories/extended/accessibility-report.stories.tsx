import type { Meta, StoryObj } from "@storybook/react-vite";

import { AccessibilityReport } from "../../src/ui/quality-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        description: "Review the result before release.",
        element: "Element",
        fix: "Fix",
        rule: "Rule",
        severity: "Severity",
        status: "open",
      },
    ]),
  },
  component: AccessibilityReport,
  parameters: {
    docs: {
      description: {
        component: AccessibilityReport.__mdxr?.description,
      },
    },
  },
  title: "Components/AccessibilityReport",
} satisfies Meta<typeof AccessibilityReport>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
