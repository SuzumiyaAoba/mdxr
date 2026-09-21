import type { Meta, StoryObj } from "@storybook/react-vite";

import { Traceability } from "../../src/ui/planning-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        files: ["src/render.ts"],
        id: "REQ-1",
        requirement: "Offline export",
        tasks: ["T-1"],
        tests: ["export.test.ts"],
      },
      {
        files: ["src/ui/data-table.tsx"],
        id: "REQ-2",
        requirement: "Keyboard support",
        tasks: ["T-2"],
        tests: [],
      },
    ]),
  },
  component: Traceability,
  parameters: {
    docs: {
      description: {
        component: Traceability.__mdxr?.description,
      },
    },
  },
  title: "Components/Traceability",
} satisfies Meta<typeof Traceability>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
