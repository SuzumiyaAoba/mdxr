import type { Meta, StoryObj } from "@storybook/react-vite";

import { Change, Changes } from "../src/ui/changes.js";

const meta = {
  component: Changes,
  title: "Components/Changes",
} satisfies Meta<typeof Changes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Changes>
      <Change kind="add" path="src/remark/headings.ts">
        slug + toc expansion
      </Change>
      <Change kind="modify" path="src/mdx.ts">
        register plugins
      </Change>
      <Change kind="rename" path="src/old.ts" to="src/new.ts" />
      <Change kind="delete" path="src/dead.ts" />
    </Changes>
  ),
};
