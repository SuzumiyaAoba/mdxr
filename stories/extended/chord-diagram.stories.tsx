import type { Meta, StoryObj } from "@storybook/react-vite";

import { ChordDiagram } from "../../src/ui/plot-chord-diagram.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        from: "API",
        to: "DB",
        value: 30,
      },
      {
        from: "Worker",
        to: "DB",
        value: 20,
      },
      {
        from: "API",
        to: "Worker",
        value: 10,
      },
    ]),
  },
  component: ChordDiagram,
  parameters: {
    docs: {
      description: {
        component: ChordDiagram.__mdxr?.description,
      },
    },
  },
  title: "Components/ChordDiagram",
} satisfies Meta<typeof ChordDiagram>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
