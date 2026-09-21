import type { Meta, StoryObj } from "@storybook/react-vite";

import { Proof } from "../../src/ui/document-references.js";

const meta = {
  args: {
    id: "even-proof",
  },
  component: Proof,
  parameters: {
    docs: {
      description: {
        component: Proof.__mdxr?.description,
      },
    },
  },
  render: (args) => (
    <Proof {...args}>
      <p>
        Write the integers as
        <code>2a</code>
        and
        <code>2b</code>. Their sum is
        <code>2(a+b)</code>.
      </p>
    </Proof>
  ),
  title: "Components/Proof",
} satisfies Meta<typeof Proof>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
