import type { Meta, StoryObj } from "@storybook/react-vite";

import { RecoveryPlan } from "../../src/ui/operations-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        action: "Run the verification suite",
        backup: "Backup",
        depends: "Depends",
        rpo: "Rpo",
        rto: "Rto",
        service: "Service",
        step: "Step",
        verification: "Verification",
      },
    ]),
  },
  component: RecoveryPlan,
  parameters: {
    docs: {
      description: {
        component: RecoveryPlan.__mdxr?.description,
      },
    },
  },
  title: "Components/RecoveryPlan",
} satisfies Meta<typeof RecoveryPlan>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
