import type { Meta, StoryObj } from "@storybook/react-vite";

import { OPTION_STATUSES, Option } from "../src/ui/option.js";

const meta = {
  argTypes: {
    status: { control: "select", options: [...OPTION_STATUSES] },
  },
  args: {
    children: <p>Deterministic render, prop validation via valibot.</p>,
    status: "recommended",
    title: "MDX component pipeline",
  },
  component: Option,
  title: "Components/Option",
} satisfies Meta<typeof Option>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Recommended: Story = {};

export const Rejected: Story = { args: { status: "rejected" } };

export const Considered: Story = { args: { status: "considered" } };
