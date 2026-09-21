import type { Meta, StoryObj } from "@storybook/react-vite";

import { CliReference } from "../../src/ui/reference-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        argument: "Argument",
        command: "Command",
        conflicts: "Conflicts",
        default: "Default",
        description: "Review the result before release.",
        example: "Example",
        flag: "Flag",
        type: "Type",
      },
    ]),
  },
  component: CliReference,
  parameters: {
    docs: {
      description: {
        component: CliReference.__mdxr?.description,
      },
    },
  },
  title: "Components/CliReference",
} satisfies Meta<typeof CliReference>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
