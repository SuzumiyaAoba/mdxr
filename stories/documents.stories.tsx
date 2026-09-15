import type { Meta, StoryObj } from "@storybook/react-vite";
import documents from "virtual:rv-documents";

const names = Object.keys(documents).toSorted();

const meta = {
  argTypes: {
    name: { control: "select", options: names },
  },
  args: { name: names[0] ?? "" },
  parameters: { layout: "fullscreen", rvDocument: true },
  render: ({ name }: { name: string }) => (
    <iframe
      className="block h-screen w-full border-0"
      sandbox="allow-scripts"
      srcDoc={documents[name] ?? ""}
      title={name}
    />
  ),
  title: "Documents/Examples",
} satisfies Meta<{ name: string }>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The real `rv render` output for each .mdx file under examples/ — same
 * frontmatter, project components, and inlined Tailwind CSS as the CLI.
 * Dark mode follows the OS setting (prefers-color-scheme), like the files
 * the CLI writes. Mermaid diagrams need network access (CDN import).
 */
export const Rendered: Story = {};
