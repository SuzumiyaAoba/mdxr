import type { Meta, StoryObj } from "@storybook/react-vite";
import documents from "virtual:mdxr-ascii";

const names = Object.keys(documents).toSorted();

const meta = {
  argTypes: {
    name: { control: "select", options: names },
  },
  args: { name: names[0] ?? "" },
  parameters: { layout: "fullscreen" },
  render: ({ name }: { name: string }) => (
    <pre className="m-0 h-screen overflow-auto bg-stone-950 p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap text-stone-200">
      {documents[name] ?? ""}
    </pre>
  ),
  title: "Documents/ASCII",
} satisfies Meta<{ name: string }>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * `mdxr text` output for each .mdx file under examples/ — every component
 * rendered as its ASCII/Markdown stand-in, so the document stays readable
 * as plain Markdown.
 */
export const Rendered: Story = {};
