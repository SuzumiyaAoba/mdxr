import type { Meta, StoryObj } from "@storybook/react-vite";

import { Provenance } from "../../src/ui/evidence-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        config: "Config",
        generated: "Generated",
        hash: "Hash",
        input: "Input",
        tool: "Tool",
        version: "1.2.0",
      },
    ]),
  },
  component: Provenance,
  parameters: {
    docs: {
      description: {
        component: Provenance.__mdxr?.description,
      },
    },
  },
  title: "Components/Provenance",
} satisfies Meta<typeof Provenance>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
