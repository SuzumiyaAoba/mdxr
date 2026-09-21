import type { Meta, StoryObj } from "@storybook/react-vite";

import { DocumentSearch } from "../../src/ui/document-inputs.js";

const meta = {
  args: {},
  component: DocumentSearch,
  parameters: {
    docs: {
      description: {
        component: DocumentSearch.__mdxr?.description,
      },
    },
  },
  render: (args) => (
    <>
      <DocumentSearch {...args} />
      <h3>Searchable section</h3>
      <p>The search finds rendering instructions in this document.</p>
    </>
  ),
  title: "Components/DocumentSearch",
} satisfies Meta<typeof DocumentSearch>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
