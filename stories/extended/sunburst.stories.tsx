import type { Meta, StoryObj } from "@storybook/react-vite";

import { Sunburst } from "../../src/ui/plot-sunburst.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        id: "app",
        name: "App",
      },
      {
        id: "ui",
        name: "UI",
        parent: "app",
        value: 60,
      },
      {
        id: "core",
        name: "Core",
        parent: "app",
        value: 40,
      },
    ]),
  },
  component: Sunburst,
  parameters: {
    docs: {
      description: {
        component: Sunburst.__mdxr?.description,
      },
    },
  },
  title: "Components/Sunburst",
} satisfies Meta<typeof Sunburst>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
