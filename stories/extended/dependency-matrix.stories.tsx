import type { Meta, StoryObj } from "@storybook/react-vite";

import { DependencyMatrix } from "../../src/ui/semantic-diagrams.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        from: "API",
        to: "DB",
        value: 3,
      },
      {
        from: "Worker",
        to: "DB",
        value: 1,
      },
    ]),
  },
  component: DependencyMatrix,
  parameters: {
    docs: {
      description: {
        component: DependencyMatrix.__mdxr?.description,
      },
    },
  },
  title: "Components/DependencyMatrix",
} satisfies Meta<typeof DependencyMatrix>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
