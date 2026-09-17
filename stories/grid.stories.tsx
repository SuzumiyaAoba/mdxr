import type { Meta, StoryObj } from "@storybook/react-vite";

import { Cell, Grid } from "../src/ui/grid.js";
import { Option } from "../src/ui/option.js";
import { Stat } from "../src/ui/stats.js";

const meta = {
  component: Grid,
  title: "Components/Grid",
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sidebar: Story = {
  render: () => (
    <Grid>
      <Cell span="8">
        <h4>Main content</h4>
        <p>Two-thirds of the row — the primary narrative.</p>
      </Cell>
      <Cell span="4">
        <h4>Sidebar</h4>
        <p>Meta, related links, or a compact TOC.</p>
      </Cell>
    </Grid>
  ),
};

export const Dashboard: Story = {
  render: () => (
    <Grid cols="4" flow="row-dense">
      <Cell span="4">
        <Stat label="Coverage" value="92%" delta="+4%" />
      </Cell>
      <Cell span="2">
        <Stat label="Open issues" value="7" delta="-3" />
      </Cell>
      <Cell span="2" rowSpan="2">
        <h4>Notes</h4>
        <p>A tall panel spanning two rows.</p>
      </Cell>
      <Cell span="2">
        <Stat label="Build time" value="48s" delta="-12s" />
      </Cell>
    </Grid>
  ),
};

export const AutoFit: Story = {
  render: () => (
    <Grid min="14rem" gap="sm">
      <Option title="Template literals" status="rejected">
        <p>Escaping bugs keep recurring.</p>
      </Option>
      <Option title="Component pipeline" status="recommended">
        <p>Deterministic + validated.</p>
      </Option>
      <Option title="Runtime eval" status="considered">
        <p>Flexible, but documents stop being data.</p>
      </Option>
    </Grid>
  ),
};
