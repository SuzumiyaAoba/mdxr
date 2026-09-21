import type { Meta, StoryObj } from "@storybook/react-vite";

import { PageBreak, PrintLayout } from "../../src/ui/document-media.js";

const meta = {
  args: {},
  component: PageBreak,
  parameters: {
    docs: {
      description: {
        component: PageBreak.__mdxr?.description,
      },
    },
  },
  render: (args) => (
    <PrintLayout title="Page break example">
      <p>First printed page.</p>
      <PageBreak {...args} />
      <p>This content starts on a new printed page.</p>
    </PrintLayout>
  ),
  title: "Components/PageBreak",
} satisfies Meta<typeof PageBreak>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
