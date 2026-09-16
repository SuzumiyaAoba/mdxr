import type { Meta, StoryObj } from "@storybook/react-vite";

import { Approval, Approvals } from "../src/ui/approvals.js";

const meta = {
  component: Approvals,
  title: "Components/Approvals",
} satisfies Meta<typeof Approvals>;

export default meta;
type Story = StoryObj<typeof meta>;

// `role` is a component prop here (not an ARIA role) — pass rows via spread so
// the a11y lint rule doesn't misread it.
const ROWS = [
  { date: "2026-09-14", name: "alice", role: "tech lead", status: "approved" },
  { name: "bob", role: "security", status: "pending" },
  { name: "dave", status: "rejected" },
] as const;

export const SignOff: Story = {
  render: () => (
    <Approvals>
      {ROWS.map((r) => (
        <Approval key={r.name} {...r} />
      ))}
      <Approval name="Carol Sato" status="changes-requested">
        Add migration notes for existing documents.
      </Approval>
    </Approvals>
  ),
};
