import type { Meta, StoryObj } from "@storybook/react-vite";

import { Logs } from "../../src/ui/investigation-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        level: "Level",
        message: "Message",
        source: "Source",
        time: "2026-09-01T09:00:00Z",
      },
    ]),
  },
  component: Logs,
  parameters: {
    docs: {
      description: {
        component: Logs.__mdxr?.description,
      },
    },
  },
  title: "Components/Logs",
} satisfies Meta<typeof Logs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
