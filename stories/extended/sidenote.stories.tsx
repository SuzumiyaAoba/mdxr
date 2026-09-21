import type { Meta, StoryObj } from "@storybook/react-vite";

import { Sidenote } from "../../src/ui/document-references.js";

const meta = {
  args: {
    title: "Context",
  },
  component: Sidenote,
  parameters: {
    docs: {
      description: {
        component: Sidenote.__mdxr?.description,
      },
    },
  },
  render: (args) => (
    <Sidenote {...args}>
      <p>This note stays close to the discussion.</p>
    </Sidenote>
  ),
  title: "Components/Sidenote",
} satisfies Meta<typeof Sidenote>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
