import type { Meta, StoryObj } from "@storybook/react-vite";

import { Search, Searches } from "../src/ui/search.js";

const meta = {
  component: Searches,
  title: "Components/Searches",
} satisfies Meta<typeof Searches>;

export default meta;
type Story = StoryObj<typeof meta>;

export const QueryLog: Story = {
  render: () => (
    <Searches title="How the code was searched">
      <Search pattern="evaluate" path="src/" tool="rg" hits="3" />
      <Search pattern="renderToStaticMarkup" path="src/" tool="rg" hits="5">
        <p>All calls originate in render.ts</p>
      </Search>
      <Search pattern="hydrateRoot" path="src/" tool="rg" hits="0">
        <p>Dead end — no client entry exists</p>
      </Search>
      <Search pattern="TODO|FIXME" path="src/" tool="rg" hits="2" />
    </Searches>
  ),
};

export const Single: Story = {
  render: () => <Search pattern="mdxToHtml" path="src/" tool="rg" hits="4" />,
};
