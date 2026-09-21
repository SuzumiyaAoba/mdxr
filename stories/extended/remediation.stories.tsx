import type { Meta, StoryObj } from "@storybook/react-vite";

import { Remediation } from "../../src/ui/operations-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        due: "Due",
        fix: "Fix",
        owner: "Platform",
        severity: "Severity",
        status: "open",
        verification: "Verification",
        vulnerability: "Vulnerability",
      },
    ]),
  },
  component: Remediation,
  parameters: {
    docs: {
      description: {
        component: Remediation.__mdxr?.description,
      },
    },
  },
  title: "Components/Remediation",
} satisfies Meta<typeof Remediation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
