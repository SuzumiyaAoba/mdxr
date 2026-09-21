import type { Meta, StoryObj } from "@storybook/react-vite";

import { DataLineage } from "../../src/ui/semantic-diagrams.js";

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
  component: DataLineage,
  parameters: {
    docs: {
      description: {
        component: DataLineage.__mdxr?.description,
      },
    },
  },
  title: "Components/DataLineage",
} satisfies Meta<typeof DataLineage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
