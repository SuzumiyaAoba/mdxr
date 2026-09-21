import type { Meta, StoryObj } from "@storybook/react-vite";

import { Scope } from "../../src/ui/planning-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        item: "Item",
        phase: "Phase",
        reason: "Required for release",
        scope: "Renderer",
      },
    ]),
  },
  component: Scope,
  parameters: {
    docs: {
      description: {
        component: Scope.__mdxr?.description,
      },
    },
  },
  title: "Components/Scope",
} satisfies Meta<typeof Scope>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
