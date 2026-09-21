import type { Meta, StoryObj } from "@storybook/react-vite";

import { PageBreak, PrintLayout } from "../../src/ui/document-media.js";

const meta = {
  args: {
    columns: "2",
  },
  component: PrintLayout,
  parameters: {
    docs: {
      description: {
        component: PrintLayout.__mdxr?.description,
      },
    },
  },
  render: (args) => (
    <PrintLayout {...args}>
      <p>First page.</p>
      <PageBreak />
      <p>Second page.</p>
    </PrintLayout>
  ),
  title: "Components/PrintLayout",
} satisfies Meta<typeof PrintLayout>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
