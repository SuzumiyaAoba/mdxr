import type { Meta, StoryObj } from "@storybook/react-vite";

import { ApiExample, Request, Response } from "../../src/ui/document-tabs.js";

const meta = {
  args: {},
  component: ApiExample,
  parameters: {
    docs: {
      description: {
        component: ApiExample.__mdxr?.description,
      },
    },
  },
  render: (args) => (
    <ApiExample {...args}>
      <Request method="GET" path="/items" headers="Accept: application/json" />
      <Response
        status="200"
        body={JSON.stringify({
          items: ["one"],
        })}
      />
    </ApiExample>
  ),
  title: "Components/ApiExample",
} satisfies Meta<typeof ApiExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
