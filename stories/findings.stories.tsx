import type { Meta, StoryObj } from "@storybook/react-vite";

import { FileRef } from "../src/ui/file-ref.js";
import { Finding, Findings } from "../src/ui/findings.js";

const meta = {
  component: Findings,
  title: "Components/Findings",
} satisfies Meta<typeof Findings>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Report: Story = {
  render: () => (
    <Findings title="Investigation results">
      <Finding confidence="confirmed" title="Rendering is synchronous">
        <p>
          <code>mdxToHtml</code> awaits <code>evaluate()</code> then calls{" "}
          <code>renderToStaticMarkup</code> — see{" "}
          <FileRef path="src/mdx.ts" lines="70-106" />.
        </p>
      </Finding>
      <Finding confidence="inferred" title="No client hydration">
        <p>
          No runtime is emitted and copy buttons use a delegated listener, so
          interactive primitives can only show their initial state.
        </p>
      </Finding>
      <Finding confidence="unverified" title="Watch mode invalidation">
        <p>
          The serve command probably reloads user components, but no test covers
          it yet.
        </p>
      </Finding>
    </Findings>
  ),
};

export const Single: Story = {
  render: () => (
    <Finding confidence="confirmed" title="Standalone finding">
      <p>Usable without the container — no number chip is shown.</p>
    </Finding>
  ),
};
