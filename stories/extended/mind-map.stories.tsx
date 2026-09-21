import type { Meta, StoryObj } from "@storybook/react-vite";

import { MindMap } from "../../src/ui/semantic-diagrams.js";

const meta = {
  args: {
    edges: JSON.stringify([
      {
        from: "client",
        label: "Request",
        to: "api",
      },
      {
        from: "api",
        label: "Query",
        to: "db",
      },
    ]),
    nodes: JSON.stringify([
      {
        id: "client",
        label: "Client",
        lane: "Application",
      },
      {
        id: "api",
        label: "API",
        lane: "Server",
      },
      {
        id: "db",
        label: "Database",
        lane: "Server",
      },
    ]),
  },
  component: MindMap,
  parameters: {
    docs: {
      description: {
        component: MindMap.__mdxr?.description,
      },
    },
  },
  title: "Components/MindMap",
} satisfies Meta<typeof MindMap>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
