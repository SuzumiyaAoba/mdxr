import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tree } from "../src/ui/tree.js";

const meta = {
  component: Tree,
  title: "Components/Tree",
} satisfies Meta<typeof Tree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FileTree: Story = {
  render: () => (
    <Tree root="mdxr/">
      <ul>
        <li>
          src/
          <ul>
            <li>render.ts — pipeline entry</li>
            <li>
              ui/
              <ul>
                <li>
                  <strong>plan.tsx</strong>
                </li>
                <li>steps.tsx</li>
                <li>…</li>
              </ul>
            </li>
            <li>remark/ — directive plugins</li>
            <li>styles/</li>
          </ul>
        </li>
        <li>
          examples/
          <ul>
            <li>plan.mdx # this document</li>
          </ul>
        </li>
        <li>package.json</li>
        <li>...</li>
      </ul>
    </Tree>
  ),
};

export const Collapsed: Story = {
  render: () => (
    <Tree open="false" root="mdxr/">
      <ul>
        <li>
          src/
          <ul>
            <li>render.ts — pipeline entry</li>
            <li>
              ui/
              <ul>
                <li>plan.tsx</li>
                <li>steps.tsx</li>
              </ul>
            </li>
          </ul>
        </li>
        <li>package.json</li>
      </ul>
    </Tree>
  ),
};

export const NoRoot: Story = {
  render: () => (
    <Tree>
      <ul>
        <li>index.ts</li>
        <li>README.md — docs</li>
      </ul>
    </Tree>
  ),
};
