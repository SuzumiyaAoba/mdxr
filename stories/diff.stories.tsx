import type { Meta, StoryObj } from "@storybook/react-vite";

import { Pre } from "../src/ui/pre.js";

const GIT_DIFF = `diff --git a/src/render.ts b/src/render.ts
index 111..222 100644
--- a/src/render.ts
+++ b/src/render.ts
@@ -40,7 +40,8 @@ export async function renderFile(
-  const out = compile(src);
+  const doc = compile(src);
+  const out = minify(doc);
   return out;
 }
 context line
diff --git a/new.ts b/new.ts
new file mode 100644
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,2 @@
+export const answer = 42;
+export const question = "unknown";
`;

const BARE = `+const enabled = true;
-const enabled = false;
 const shared = 0;`;

const meta = {
  component: Pre,
  title: "Components/Diff",
} satisfies Meta<typeof Pre>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GitDiff: Story = {
  render: () => (
    <Pre>
      <code className="language-diff">{GIT_DIFF}</code>
    </Pre>
  ),
};

export const BareStream: Story = {
  render: () => (
    <Pre>
      <code className="language-diff">{BARE}</code>
    </Pre>
  ),
};

export const PatchFence: Story = {
  render: () => (
    <Pre>
      <code className="language-patch">{GIT_DIFF}</code>
    </Pre>
  ),
};
