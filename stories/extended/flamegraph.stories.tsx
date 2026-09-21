import type { Meta, StoryObj } from "@storybook/react-vite";

import { Flamegraph } from "../../src/ui/semantic-diagrams.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        id: "render",
        value: 100,
      },
      {
        id: "parse",
        parent: "render",
        value: 25,
      },
      {
        id: "compile",
        parent: "render",
        value: 60,
      },
      {
        id: "highlight",
        parent: "compile",
        value: 20,
      },
    ]),
  },
  component: Flamegraph,
  parameters: {
    docs: {
      description: {
        component: Flamegraph.__mdxr?.description,
      },
    },
  },
  title: "Components/Flamegraph",
} satisfies Meta<typeof Flamegraph>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
