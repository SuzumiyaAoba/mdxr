import type { Meta, StoryObj } from "@storybook/react-vite";

import { Toc } from "../src/ui/toc.js";

const meta = {
  component: Toc,
  title: "Components/Toc",
} satisfies Meta<typeof Toc>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * In documents the remark plugin injects this list from the headings —
 * listItem children arrive as `p > a` (+ a nested list when subsections
 * exist), which is the shape rendered here.
 */
export const Default: Story = {
  render: () => (
    <Toc>
      <ul>
        <li>
          <p>
            <a href="#context">Context</a>
          </p>
        </li>
        <li>
          <p>
            <a href="#pipeline">Pipeline</a>
          </p>
          <ul>
            <li>
              <p>
                <a href="#remark-stage">remark stage</a>
              </p>
            </li>
            <li>
              <p>
                <a href="#rehype-stage">rehype stage</a>
              </p>
            </li>
          </ul>
        </li>
        <li>
          <p>
            <a href="#risks">Risks</a>
          </p>
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
          <p>
            <a href="#a">A</a>
          </p>
        </li>
      </ul>
    </Toc>
  ),
};

export const InitiallyClosed: Story = {
  render: () => (
    <Toc open="false">
      <ul>
        <li>
          <p>
            <a href="#a">A</a>
          </p>
        </li>
      </ul>
    </Toc>
  ),
};
