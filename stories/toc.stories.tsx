import type { Meta, StoryObj } from "@storybook/react-vite";

import { Toc } from "../src/ui/toc.js";

const meta = {
  component: Toc,
  title: "Components/Toc",
} satisfies Meta<typeof Toc>;

export default meta;
type Story = StoryObj<typeof meta>;

/** In documents the remark plugin injects this list from the headings. */
export const Default: Story = {
  render: () => (
    <Toc>
      <ul>
        <li>
          <a href="#context">Context</a>
        </li>
        <li>
          <a href="#pipeline">Pipeline</a>
          <ul>
            <li>
              <a href="#remark-stage">remark stage</a>
            </li>
            <li>
              <a href="#rehype-stage">rehype stage</a>
            </li>
          </ul>
        </li>
        <li>
          <a href="#risks">Risks</a>
        </li>
      </ul>
    </Toc>
  ),
};

export const CustomTitle: Story = {
  render: () => (
    <Toc title="Sections">
      <ul>
        <li>
          <a href="#a">A</a>
        </li>
      </ul>
    </Toc>
  ),
};
