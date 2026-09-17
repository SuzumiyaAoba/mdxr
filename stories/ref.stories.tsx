import type { Meta, StoryObj } from "@storybook/react-vite";

import { Issue, PR, Ref } from "../src/ui/ref.js";

const meta = {
  component: Ref,
  title: "Components/Ref",
} satisfies Meta<typeof Ref>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LinkCard: Story = {
  args: {
    children: "Component model used by the renderer.",
    href: "https://mdxjs.com",
    title: "MDX documentation",
  },
};

export const IssueAndPR: Story = {
  render: () => (
    <p>
      Tracked in{" "}
      <Issue repo="SuzumiyaAoba/mdxr" number="12">
        catalog drift
      </Issue>{" "}
      {/* oxlint-disable-next-line react/jsx-pascal-case */}
      and fixed by <PR repo="SuzumiyaAoba/mdxr" number="34" />.
    </p>
  ),
};
