import type { Meta, StoryObj } from "@storybook/react-vite";

import { PermissionMatrix } from "../../src/ui/operations-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        action: "Run the verification suite",
        allowed: "Allowed",
        condition: "Condition",
        resource: "Resource",
        role: "Role",
      },
    ]),
  },
  component: PermissionMatrix,
  parameters: {
    docs: {
      description: {
        component: PermissionMatrix.__mdxr?.description,
      },
    },
  },
  title: "Components/PermissionMatrix",
} satisfies Meta<typeof PermissionMatrix>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
