import type { Meta, StoryObj } from "@storybook/react-vite";

import { Wizard } from "../../src/ui/document-inputs.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        label: "Target",
        name: "target",
        options: ["Web", "CLI"],
        required: true,
      },
      {
        label: "Site URL",
        name: "url",
        required: true,
        when: {
          target: "Web",
        },
      },
      {
        label: "Notes",
        name: "notes",
        type: "textarea",
      },
    ]),
  },
  component: Wizard,
  parameters: {
    docs: {
      description: {
        component: Wizard.__mdxr?.description,
      },
    },
  },
  title: "Components/Wizard",
} satisfies Meta<typeof Wizard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
