import type { Meta, StoryObj } from "@storybook/react-vite";

import { StateDiagram } from "../../src/ui/semantic-diagrams.js";

const meta = {
  args: {
    edges: JSON.stringify([
      {
        action: "load",
        from: "client",
        guard: "valid",
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
  component: StateDiagram,
  parameters: {
    docs: {
      description: {
        component: StateDiagram.__mdxr?.description,
      },
    },
  },
  title: "Components/StateDiagram",
} satisfies Meta<typeof StateDiagram>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
