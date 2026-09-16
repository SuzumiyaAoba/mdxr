import type { Meta, StoryObj } from "@storybook/react-vite";

import { Column, Columns } from "../src/ui/columns.js";
import { Option } from "../src/ui/option.js";

const meta = {
  component: Columns,
  title: "Components/Columns",
} satisfies Meta<typeof Columns>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Options: Story = {
  render: () => (
    <Columns>
      <Option title="Keep template literals" status="rejected">
        <p>Escaping bugs keep recurring.</p>
      </Option>
      <Option title="MDX component pipeline" status="recommended">
        <p>Deterministic render, validated props.</p>
      </Option>
    </Columns>
  ),
};

export const ThreeColumns: Story = {
  render: () => (
    <Columns cols="3">
      <Column>
        <h4>Before</h4>
        <p>String interpolation everywhere.</p>
      </Column>
      <Column>
        <h4>After</h4>
        <p>Typed components with schemas.</p>
      </Column>
      <Column>
        <h4>Result</h4>
        <p>Fewer rendering bugs.</p>
      </Column>
    </Columns>
  ),
};
