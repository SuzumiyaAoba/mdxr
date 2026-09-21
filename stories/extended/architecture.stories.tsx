import type { Meta, StoryObj } from "@storybook/react-vite";

import { Architecture } from "../../src/ui/semantic-diagrams.js";

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
        group: "Application",
        id: "client",
        label: "Client",
        lane: "Application",
      },
      {
        group: "Server",
        id: "api",
        label: "API",
        lane: "Server",
      },
      {
        group: "Server",
        id: "db",
        label: "Database",
        lane: "Server",
      },
    ]),
  },
  component: Architecture,
  parameters: {
    docs: {
      description: {
        component: Architecture.__mdxr?.description,
      },
    },
  },
  title: "Components/Architecture",
} satisfies Meta<typeof Architecture>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
