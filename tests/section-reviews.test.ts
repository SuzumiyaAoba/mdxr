import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseSectionReviews } from "../src/section-reviews.js";
import { renderDoc } from "./helpers.js";

const REVIEW_HOST = /<mdxr-section-review\b[^>]*>/gu;
const SECTION_ID = /data-section-id="(?<id>[^"]+)"/u;
const SECTION_REVISION = /data-section-revision="(?<revision>[^"]+)"/u;

const reviews = (body: string) =>
  [...body.matchAll(REVIEW_HOST)].map(([host]) => ({
    id: SECTION_ID.exec(host)?.groups?.id,
    revision: SECTION_REVISION.exec(host)?.groups?.revision,
  }));

describe("section review metadata", () => {
  it("uses unique h2 identities and excludes overview, subheadings, and nested headings", async () => {
    const { body } = await renderDoc(
      "# Document\n\nIntro.\n\n## Same\n\nFirst.\n\n### Detail\n\n> ## Quote\n\n## Same\n\nSecond.\n\n## 日本語 & `code`\n\nLast."
    );
    expect(reviews(body).map(({ id }) => id)).toStrictEqual([
      "same",
      "same-1",
      "日本語-code",
    ]);
    expect(new Set(reviews(body).map(({ revision }) => revision)).size).toBe(3);
    expect(body).toContain('<h2 id="same">Same</h2>');
    expect(body).toContain('<h2 id="quote">Quote</h2>');
  });

  it("supports a Plan root without treating headings in other components as sections", async () => {
    const { body } = await renderDoc(
      '<Plan title="Plan">\n\n## Design\n\n<Callout>\n\n## Nested\n\nNote.\n\n</Callout>\n\n## Delivery\n\nDone.\n\n</Plan>'
    );
    expect(reviews(body).map(({ id }) => id)).toStrictEqual([
      "design",
      "delivery",
    ]);
  });

  it("keeps reviews stable across line shifts, unrelated edits, and section reordering", async () => {
    const alpha = '## Alpha\n\nText.\n\n<Input defaultValue="One" />';
    const beta = "## Beta\n\n### Detail\n\nDetails.";
    const original = await renderDoc(`${alpha}\n\n${beta}`);
    const shifted = await renderDoc(
      `# Title\n\nNew introduction.\n\n${beta}\n\n${alpha}`
    );
    expect(
      reviews(shifted.body).toSorted((a, b) =>
        (a.id ?? "").localeCompare(b.id ?? "")
      )
    ).toStrictEqual(reviews(original.body));
    const edited = await renderDoc(
      `${alpha}\n\n${beta.replace("Details.", "Updated details.")}`
    );
    expect(reviews(edited.body)[0]).toStrictEqual(reviews(original.body)[0]);
    expect(reviews(edited.body)[1]?.revision).not.toBe(
      reviews(original.body)[1]?.revision
    );
  });

  it("invalidates confirmation when component props or referenced content change", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-section-review-"));
    const file = path.join(dir, "plan.mdx");
    const source =
      '## Design\n\n<Input defaultValue="First" />\n\n<Include path="details.mdx" />';
    try {
      await writeFile(path.join(dir, "details.mdx"), "Initial details.");
      const { body: initialBody } = await renderDoc(source, file);
      const { body: propBody } = await renderDoc(
        source.replace("First", "Second"),
        file
      );
      const initial = reviews(initialBody);
      const changedProp = reviews(propBody);
      expect(changedProp[0]?.revision).not.toBe(initial[0]?.revision);
      await writeFile(path.join(dir, "details.mdx"), "Changed details.");
      const { body: includeBody } = await renderDoc(source, file);
      const changedInclude = reviews(includeBody);
      expect(changedInclude[0]?.revision).not.toBe(initial[0]?.revision);
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("invalidates references when their definition outside the section changes", async () => {
    const source =
      "## Alpha\n\nRead [the docs][docs] and note[^note].\n\n## Beta\n\nIndependent text.\n\n[docs]: https://example.com/old\n\n[^note]: Original note.";
    const original = await renderDoc(source);
    const link = await renderDoc(
      source.replace("example.com/old", "example.com/new")
    );
    const note = await renderDoc(
      source.replace("Original note.", "Updated note.")
    );
    expect(reviews(link.body)[0]?.revision).not.toBe(
      reviews(original.body)[0]?.revision
    );
    expect(reviews(link.body)[1]).toStrictEqual(reviews(original.body)[1]);
    expect(reviews(note.body)[0]?.revision).not.toBe(
      reviews(original.body)[0]?.revision
    );
  });

  it("emits no review controls without document-level h2 sections", async () => {
    const { body } = await renderDoc(
      "# Title\n\n> ## Quote\n\n```md\n## Code\n```"
    );
    expect(reviews(body)).toStrictEqual([]);
  });
});

describe("saved section reviews", () => {
  it("accepts reviewed revisions and rejects malformed or ambiguous records", () => {
    const section = { id: "design", revision: "abc123" };
    expect(parseSectionReviews(null)).toStrictEqual([]);
    expect(
      parseSectionReviews(JSON.stringify({ sections: [section], version: 1 }))
    ).toStrictEqual([section]);
    for (const value of [
      { sections: [section], version: 2 },
      { sections: [section, section], version: 1 },
      { sections: [{ ...section, id: "" }], version: 1 },
      { sections: [{ ...section, revision: false }], version: 1 },
      { sections: [null], version: 1 },
      { sections: {}, version: 1 },
    ]) {
      expect(() => parseSectionReviews(JSON.stringify(value))).toThrow(
        /Invalid saved section reviews|Duplicate section review identifiers/u
      );
    }
    expect(() => parseSectionReviews("invalid JSON")).toThrow(SyntaxError);
  });
});
