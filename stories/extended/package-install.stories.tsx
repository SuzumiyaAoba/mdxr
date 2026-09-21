import type { Meta, StoryObj } from "@storybook/react-vite";

import { PackageInstall } from "../../src/ui/document-tabs.js";

const meta = {
  args: {
    dev: "true",
    packages: "@suzumiyaaoba/mdxr",
  },
  component: PackageInstall,
  parameters: {
    docs: {
      description: {
        component: PackageInstall.__mdxr?.description,
      },
    },
  },
  title: "Components/PackageInstall",
} satisfies Meta<typeof PackageInstall>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const ProductionDependency: Story = { args: { dev: "false" } };
