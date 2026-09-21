import type { Meta, StoryObj } from "@storybook/react-vite";

import { DependencyPlan } from "../../src/ui/planning-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        duration: 2,
        id: "design",
      },
      {
        depends: ["design"],
        duration: 5,
        id: "build",
      },
      {
        depends: ["design"],
        duration: 2,
        id: "docs",
      },
      {
        depends: ["build", "docs"],
        duration: 1,
        id: "release",
      },
    ]),
  },
  component: DependencyPlan,
  parameters: {
    docs: {
      description: {
        component: DependencyPlan.__mdxr?.description,
      },
    },
  },
  title: "Components/DependencyPlan",
} satisfies Meta<typeof DependencyPlan>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
