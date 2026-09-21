import type { Meta, StoryObj } from "@storybook/react-vite";

import { MaintenanceWindow } from "../../src/ui/operations-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        end: "2026-09-01T02:30:00Z",
        name: "Database upgrade",
        owner: "Platform",
        start: "2026-09-01T02:00:00Z",
        status: "planned",
      },
    ]),
  },
  component: MaintenanceWindow,
  parameters: {
    docs: {
      description: {
        component: MaintenanceWindow.__mdxr?.description,
      },
    },
  },
  title: "Components/MaintenanceWindow",
} satisfies Meta<typeof MaintenanceWindow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
