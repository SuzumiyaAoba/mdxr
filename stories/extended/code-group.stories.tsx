import type { Meta, StoryObj } from "@storybook/react-vite";

import { CodeGroup } from "../../src/ui/document-tabs.js";
import { Pre } from "../../src/ui/pre.js";

const meta = {
  args: {
    syncKey: "language",
  },
  component: CodeGroup,
  parameters: {
    docs: {
      description: {
        component: CodeGroup.__mdxr?.description,
      },
    },
  },
  render: (args) => (
    <CodeGroup {...args}>
      <Pre>
        <code className="language-ts">const value = 1;</code>
      </Pre>
      <Pre>
        <code className="language-python">value = 1</code>
      </Pre>
    </CodeGroup>
  ),
  title: "Components/CodeGroup",
} satisfies Meta<typeof CodeGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
