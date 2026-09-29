import { describe, expect, it } from "vitest";

import {
  normalizeLibraryText,
  searchLibraryDocuments,
} from "../src/library-search.js";
import type { SearchableLibraryDocument } from "../src/library-search.js";

const document = (
  id: string,
  title: string,
  body: string,
  options: { status?: string; updatedAt?: string } = {}
): SearchableLibraryDocument => ({
  body,
  id,
  path: id,
  status: options.status ?? "",
  title,
  updatedAt: options.updatedAt ?? "2026-09-29T00:00:00.000Z",
});

describe("Japanese document search", () => {
  it("normalizes width, case, voiced kana, and hiragana/katakana", () => {
    expect(normalizeLibraryText("ＡＢＣ ｶﾞ か\u3099 ガ カタカナ")).toBe(
      "abc が が が かたかな"
    );
  });

  it("matches contiguous Japanese text and ANDs whitespace-separated terms", () => {
    const documents = [
      document(
        "plans/auth.mdx",
        "認証計画",
        "APIの動作確認と日本語検索を扱う。"
      ),
      document("plans/other.mdx", "別の計画", "APIの動作だけを扱う。"),
    ];

    expect(
      searchLibraryDocuments(documents, { query: "ＡＰＩ　確認" }).map(
        ({ id }) => id
      )
    ).toStrictEqual(["plans/auth.mdx"]);
    expect(
      searchLibraryDocuments(documents, { query: "日本語検索" }).map(
        ({ id }) => id
      )
    ).toStrictEqual(["plans/auth.mdx"]);
  });

  it("searches the relative path and prioritizes title matches", () => {
    const documents = [
      document("plans/agent-coding.mdx", "Other notes", "coding details"),
      document("plans/japanese-search.mdx", "日本語検索", ""),
      document("plans/more.mdx", "Other notes", "日本語検索の詳細"),
    ];

    expect(
      searchLibraryDocuments(documents, { query: "日本語検索" }).map(
        ({ id }) => id
      )
    ).toStrictEqual(["plans/japanese-search.mdx", "plans/more.mdx"]);
    expect(
      searchLibraryDocuments(documents, { query: "agent coding" }).map(
        ({ id }) => id
      )
    ).toStrictEqual(["plans/agent-coding.mdx"]);
  });

  it("returns original UTF-16 highlight offsets after normalization", () => {
    const title = "xＦｏｏ ﬁか\u3099😀";
    const results = searchLibraryDocuments(
      [document("special.mdx", title, "")],
      {
        query: "foo fi が 😀",
      }
    );

    expect(results[0]?.titleMatches).toStrictEqual([
      { end: 4, start: 1 },
      { end: 10, start: 5 },
    ]);
  });

  it("keeps excerpt offsets aligned after clipping around a Japanese hit", () => {
    const body = `${"前".repeat(220)}認証😀機能を追加する。${"後".repeat(40)}`;
    const [result] = searchLibraryDocuments(
      [document("long.mdx", "長い文書", body)],
      { query: "😀機能" }
    );

    expect(result?.excerpt.startsWith("…")).toBeTruthy();
    const hitStart = result?.excerpt.indexOf("😀機能") ?? -1;
    expect(result?.excerptMatches).toContainEqual({
      end: hitStart + "😀機能".length,
      start: hitStart,
    });
  });

  it("treats an empty status as unfiltered and sorts empty searches by update", () => {
    const documents = [
      document("older.mdx", "設計10", "", {
        status: "todo",
        updatedAt: "2026-09-28T00:00:00.000Z",
      }),
      document("newer.mdx", "設計2", "", {
        status: "done",
        updatedAt: "2026-09-29T00:00:00.000Z",
      }),
    ];

    expect(
      searchLibraryDocuments(documents, { query: "", status: "" }).map(
        ({ id }) => id
      )
    ).toStrictEqual(["newer.mdx", "older.mdx"]);
    expect(
      searchLibraryDocuments(documents, { query: "", sort: "title" }).map(
        ({ id }) => id
      )
    ).toStrictEqual(["newer.mdx", "older.mdx"]);
    expect(
      searchLibraryDocuments(documents, { query: "", status: "todo" }).map(
        ({ id }) => id
      )
    ).toStrictEqual(["older.mdx"]);
  });
});
