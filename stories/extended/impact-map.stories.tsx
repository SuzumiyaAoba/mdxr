import type { Meta, StoryObj } from "@storybook/react-vite";

import { ImpactMap } from "../../src/ui/semantic-diagrams.js";

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
    options: JSON.stringify({
      changed: ["api"],
    }),
  },
  component: ImpactMap,
  parameters: {
    docs: {
      description: {
        component: ImpactMap.__mdxr?.description,
      },
    },
  },
  title: "Components/ImpactMap",
} satisfies Meta<typeof ImpactMap>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
