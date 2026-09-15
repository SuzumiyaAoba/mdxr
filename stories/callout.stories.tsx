import type { Meta, StoryObj } from "@storybook/react-vite";

import { CALLOUT_KINDS, Callout } from "../src/ui/callout.js";

const meta = {
  argTypes: {
    kind: { control: "select", options: [...CALLOUT_KINDS] },
  },
  args: {
    children: "Something worth highlighting about this document.",
    kind: "note",
  },
  component: Callout,
  title: "Components/Callout",
} satisfies Meta<typeof Callout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Note: Story = {};

export const WithTitle: Story = {
  args: {
    children:
      "Documents have no data fetching, so renderToStaticMarkup keeps the pipeline synchronous.",
    kind: "decision",
    title: "Why renderToStaticMarkup?",
  },
};

export const AllKinds: Story = {
  render: () => (
    <div>
      {CALLOUT_KINDS.map((kind) => (
        <Callout key={kind} kind={kind}>
          {`A ${kind} callout produced by :::${kind} or a GitHub alert.`}
        </Callout>
      ))}
    </div>
  ),
};
