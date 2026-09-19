import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

import { diffHighlightJson } from "../src/rehype/shiki.js";
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

/**
 * Stories mount `Pre` directly, skipping rehypeShiki — so the `data-diffhl`
 * payload rendered documents get for free is fetched here and handed to the
 * code element the same way. Rows render plain until the payload arrives,
 * like a document before its first highlight pass.
 */
const DiffPre = ({
  lang,
  meta: fenceMeta = "",
  text,
}: {
  lang: "diff" | "patch";
  meta?: string;
  text: string;
}) => {
  const [hl, setHl] = useState<string>();
  useEffect(() => {
    let live = true;
    const load = async () => {
      const json = await diffHighlightJson(text, fenceMeta);
      if (live) {
        setHl(json);
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, [text, fenceMeta]);
  return (
    <Pre meta={fenceMeta}>
      <code className={`language-${lang}`} data-diffhl={hl}>
        {text}
      </code>
    </Pre>
  );
};

const meta = {
  component: Pre,
  title: "Components/Diff",
} satisfies Meta<typeof Pre>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GitDiff: Story = {
  render: () => <DiffPre lang="diff" text={GIT_DIFF} />,
};

export const BareStream: Story = {
  render: () => <DiffPre lang="diff" meta='title="src/flags.ts"' text={BARE} />,
};

export const PatchFence: Story = {
  render: () => <DiffPre lang="patch" text={GIT_DIFF} />,
};
