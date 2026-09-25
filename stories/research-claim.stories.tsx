import type { Meta, StoryObj } from "@storybook/react-vite";

import { ResearchClaim } from "../src/ui/research-claim.js";

const meta = {
  args: {
    children: "Separate the interface from execution.",
    kind: "proposal",
    title: "Runtime boundary",
  },
  component: ResearchClaim,
  title: "Components/ResearchClaim",
} satisfies Meta<typeof ResearchClaim>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Documented: Story = {
  args: { checked: "2026-09-25", kind: "documented", source: "manual" },
};
export const Inference: Story = {
  args: { kind: "inference", source: "manual" },
};
export const Unconfirmed: Story = { args: { kind: "unknown" } };
