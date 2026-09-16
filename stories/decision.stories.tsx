import type { Meta, StoryObj } from "@storybook/react-vite";

import { DECISION_STATUSES, Decision } from "../src/ui/decision.js";

const meta = {
  argTypes: {
    status: { control: "select", options: [...DECISION_STATUSES] },
  },
  args: {
    children: (
      <p>
        Documents have no data fetching — a synchronous renderer keeps the CLI
        simple and the output fully static.
      </p>
    ),
    date: "2026-09-12",
    status: "accepted",
    title: "Use renderToStaticMarkup (sync)",
  },
  component: Decision,
  title: "Components/Decision",
} satisfies Meta<typeof Decision>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Accepted: Story = {};

export const Proposed: Story = {
  args: { date: undefined, status: "proposed" },
};

export const Superseded: Story = { args: { status: "superseded" } };
