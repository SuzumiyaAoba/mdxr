import type { Meta, StoryObj } from "@storybook/react-vite";

import { DocumentHistory } from "../../src/ui/evidence-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        author: "Author",
        date: "2026-09-01",
        reason: "Required for release",
        supersededBy: "Supersededby",
        version: "1.2.0",
      },
    ]),
  },
  component: DocumentHistory,
  parameters: {
    docs: {
      description: {
        component: DocumentHistory.__mdxr?.description,
      },
    },
  },
  title: "Components/DocumentHistory",
} satisfies Meta<typeof DocumentHistory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
