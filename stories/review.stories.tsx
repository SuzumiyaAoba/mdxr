import type { Meta, StoryObj } from "@storybook/react-vite";

import { Comment, Review } from "../src/ui/review.js";
import { Severity } from "../src/ui/severity.js";
import { Verdict } from "../src/ui/verdict.js";

const meta = {
  component: Review,
  title: "Components/Review",
} satisfies Meta<typeof Review>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CodeReview: Story = {
  render: () => (
    <Review title="PR #42 review" verdict="changes">
      <Comment
        file="src/mdx.ts"
        lines="42-58"
        severity="high"
        title="Unbounded recursion"
      >
        <p>
          The visitor recurses over the AST without a depth cap — a hostile doc
          can overflow the stack.
        </p>
      </Comment>
      <Comment
        file="src/render.ts"
        lines="12"
        severity="medium"
        title="Unchecked return value"
      >
        <p>
          <code>writeFile</code> errors are swallowed; surface them to the CLI
          exit code.
        </p>
      </Comment>
      <Comment severity="low" title="Naming nit">
        <p>
          <code>out</code> → <code>result</code> reads better at the call site.
        </p>
      </Comment>
      <Comment severity="info" title="Nice refactor">
        <p>Extracting the tone table makes this much easier to extend.</p>
      </Comment>
    </Review>
  ),
};

export const VerdictBanner: Story = {
  render: () => (
    <div>
      <Verdict status="approve" title="Ready to merge">
        <p>All blocking comments resolved; CI is green.</p>
      </Verdict>
      <Verdict status="warn" title="Deploy with care">
        <p>Schema change ships without a backfill — run it off-peak.</p>
      </Verdict>
      <Verdict status="fail" title="Do not merge">
        <p>Migration is not reversible and touches the users table.</p>
      </Verdict>
    </div>
  ),
};

export const SeverityScale: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Severity level="critical" />
      <Severity level="high" />
      <Severity level="medium" />
      <Severity level="low" />
      <Severity level="info" />
    </div>
  ),
};
