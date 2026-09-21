import type { Meta, StoryObj } from "@storybook/react-vite";

import { DecisionTree } from "../../src/ui/semantic-diagrams.js";

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
        condition: "Request valid?",
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
  component: DecisionTree,
  parameters: {
    docs: {
      description: {
        component: DecisionTree.__mdxr?.description,
      },
    },
  },
  title: "Components/DecisionTree",
} satisfies Meta<typeof DecisionTree>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
