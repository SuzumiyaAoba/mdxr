import type { Meta, StoryObj } from "@storybook/react-vite";

import { ContractResults } from "../../src/ui/quality-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        actual: "Ready",
        consumer: "Consumer",
        contract: "Contract",
        expected: "Ready",
        provider: "Provider",
        status: "open",
      },
    ]),
  },
  component: ContractResults,
  parameters: {
    docs: {
      description: {
        component: ContractResults.__mdxr?.description,
      },
    },
  },
  title: "Components/ContractResults",
} satisfies Meta<typeof ContractResults>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };
