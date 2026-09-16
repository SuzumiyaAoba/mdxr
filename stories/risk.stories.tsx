import type { Meta, StoryObj } from "@storybook/react-vite";

import { RISK_LEVELS, Risk } from "../src/ui/risk.js";

const meta = {
  argTypes: {
    level: { control: "select", options: [...RISK_LEVELS] },
  },
  args: {
    children: <p>`evaluate()` semantics changed across majors before.</p>,
    level: "high",
    mitigation: "Pin @mdx-js/mdx; run weekly compat CI",
    title: "MDX ecosystem drift",
  },
  component: Risk,
  title: "Components/Risk",
} satisfies Meta<typeof Risk>;

export default meta;
type Story = StoryObj<typeof meta>;

export const High: Story = {};

export const Low: Story = {
  args: { level: "low", mitigation: undefined },
};
