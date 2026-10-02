import vm from "node:vm";

import { transformSync } from "esbuild";
import { describe, expect, it } from "vitest";

import { LIVE_RELOAD_JS, MERMAID_JS, THEME_JS } from "../src/assets/scripts.js";
import { clientJs } from "../src/client-js.js";
import { inlineScript, inlineStyle } from "../src/html.js";

type MediaChangeListener = (event: { matches: boolean }) => void;

class FakeThemeElement {
  readonly attributes = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  readonly classes = new Set<string>();
  readonly classList = {
    contains: (name: string): boolean => this.classes.has(name),
    remove: (name: string): void => {
      this.classes.delete(name);
    },
    toggle: (name: string, force?: boolean): void => {
      if (force ?? !this.classes.has(name)) {
        this.classes.add(name);
      } else {
        this.classes.delete(name);
      }
    },
  };
  readonly style = { colorScheme: "" };

  hasAttribute(name: string): boolean {
    const datasetKey = name
      .replace(/^data-/u, "")
      .replaceAll(/-(?<letter>[a-z])/gu, (_match, letter: string) =>
        letter.toUpperCase()
      );
    return this.attributes.has(name) || Object.hasOwn(this.dataset, datasetKey);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

interface ThemeScriptHarness {
  button: FakeThemeElement;
  reactButton: FakeThemeElement;
  root: FakeThemeElement;
  triggerDOMContentLoaded: () => void;
  triggerSystemChange: (matches: boolean) => void;
}

const runThemeScript = (
  storedMode: string | null,
  systemDark: boolean,
  storageAvailable = true
): ThemeScriptHarness => {
  const root = new FakeThemeElement();
  const button = new FakeThemeElement();
  const reactButton = new FakeThemeElement();
  reactButton.dataset.docThemeReact = "";
  reactButton.dataset.mode = "auto";
  reactButton.setAttribute("aria-label", "テーマを切り替え");
  const mediaListeners = new Set<MediaChangeListener>();
  const domReadyListeners: (() => void)[] = [];

  new vm.Script(THEME_JS).runInNewContext({
    HTMLElement: FakeThemeElement,
    addEventListener: (_type: string, listener: () => void): void => {
      domReadyListeners.push(listener);
    },
    document: {
      documentElement: root,
      querySelectorAll: (): FakeThemeElement[] => [button, reactButton],
    },
    localStorage: {
      getItem: (): string | null => {
        if (!storageAvailable) {
          throw new Error("Storage is unavailable");
        }
        return storedMode;
      },
    },
    matchMedia: () => ({
      addEventListener: (
        _type: string,
        listener: MediaChangeListener
      ): void => {
        mediaListeners.add(listener);
      },
      matches: systemDark,
    }),
  });

  return {
    button,
    reactButton,
    root,
    triggerDOMContentLoaded: () => {
      for (const listener of domReadyListeners) {
        listener();
      }
    },
    triggerSystemChange: (matches) => {
      for (const listener of mediaListeners) {
        listener({ matches });
      }
    },
  };
};

/**
 * Smoke tests for every script inlined into rendered documents: a syntax
 * slip here silently breaks every emitted page, so each snippet gets parsed
 * — `vm.Script` for classic scripts, esbuild's parser for the module-syntax
 * mermaid bootstrap (which `vm.Script` can't take because of `import`).
 */

describe(clientJs, () => {
  it("bundles src/client into a parseable IIFE", async () => {
    const js = await clientJs();
    expect(() => new vm.Script(js)).not.toThrow();
    expect(js).toContain("addEventListener");
    // The delegated behaviors the markup depends on.
    expect(js).toContain("data-copy");
    expect(js).toContain("data-ask");
    expect(js).toContain("data-doc-theme");
  });

  it("wires the board interactions (drag, move, copy)", async () => {
    const js = await clientJs();
    for (const s of [
      "data-board-card",
      "data-board-lane",
      "data-board-move",
      "data-board-copy",
      "dragstart",
    ]) {
      expect(js).toContain(s);
    }
  });

  it("wires the comments interactions (add, reply, submit, copy)", async () => {
    const js = await clientJs();
    for (const s of [
      "data-comment-add",
      "data-comment-reply",
      "data-comment-submit",
      "data-comment-cancel",
      "data-comment-tpl",
      "data-doc-comment",
      "data-comments-copy",
      // The fence payload is read via dataset — the property name survives.
      "commentsCode",
      "keydown",
    ]) {
      expect(js).toContain(s);
    }
  });

  it("is memoized", async () => {
    await expect(clientJs()).resolves.toBe(await clientJs());
  });
});

describe("inline script snippets", () => {
  it("THEME_JS parses", () => {
    expect(() => new vm.Script(THEME_JS)).not.toThrow();
  });

  it("applies a stored mode before paint and leaves React labels alone", () => {
    const { button, reactButton, root, triggerDOMContentLoaded } =
      runThemeScript("dark", false);
    triggerDOMContentLoaded();

    expect({
      buttonLabel: button.attributes.get("aria-label"),
      buttonMode: button.dataset.mode,
      colorScheme: root.style.colorScheme,
      darkClass: root.classList.contains("dark"),
      htmlMode: root.dataset.docThemeMode,
      reactLabel: reactButton.attributes.get("aria-label"),
      reactMode: reactButton.dataset.mode,
    }).toStrictEqual({
      buttonLabel: "Switch theme (current: dark)",
      buttonMode: "dark",
      colorScheme: "dark",
      darkClass: true,
      htmlMode: "dark",
      reactLabel: "テーマを切り替え",
      reactMode: "auto",
    });
  });

  it("follows system color changes while in auto mode", () => {
    const { root, triggerSystemChange } = runThemeScript(null, false);
    triggerSystemChange(true);

    expect({
      colorScheme: root.style.colorScheme,
      darkClass: root.classList.contains("dark"),
      htmlMode: root.dataset.docThemeMode,
    }).toStrictEqual({
      colorScheme: "dark",
      darkClass: true,
      htmlMode: "auto",
    });
  });

  it("keeps an explicit mode when storage is unavailable", () => {
    const { root, triggerSystemChange } = runThemeScript(null, true, false);
    root.dataset.docThemeMode = "dark";
    root.classList.toggle("dark", true);
    root.style.colorScheme = "dark";
    triggerSystemChange(false);

    expect({
      colorScheme: root.style.colorScheme,
      darkClass: root.classList.contains("dark"),
      htmlMode: root.dataset.docThemeMode,
    }).toStrictEqual({
      colorScheme: "dark",
      darkClass: true,
      htmlMode: "dark",
    });
  });

  it("LIVE_RELOAD_JS parses", () => {
    expect(() => new vm.Script(LIVE_RELOAD_JS)).not.toThrow();
  });

  it("MERMAID_JS parses as a module", () => {
    // `import`/`await` make this a module — parse it via esbuild.
    expect(() =>
      transformSync(MERMAID_JS, { format: "esm", loader: "js" })
    ).not.toThrow();
  });
});

describe(inlineScript, () => {
  it("neutralizes HTML parser terminators", () => {
    expect(inlineScript('const s = "</script>";')).toContain("\\u003C/script");
    expect(inlineScript("<!-- comment")).toContain("\\u003C!--");
    expect(inlineScript("a < b")).toBe("a < b");
  });

  it.each(["</SCRIPT>", "</ScRiPt>", "</script>"])(
    "preserves the value of a string containing %s",
    (value) => {
      const script = inlineScript(JSON.stringify(value));
      expect(script).not.toMatch(/<\/script/iu);
      expect(new vm.Script(script).runInNewContext()).toBe(value);
    }
  );
});

describe(inlineStyle, () => {
  it.each(["</STYLE>", "</StYlE>", "</style>"])(
    "preserves the content of a CSS string containing %s",
    (value) => {
      const css = `.label::after { content: ${JSON.stringify(value)}; }`;
      const escaped = inlineStyle(css);
      expect(escaped).not.toMatch(/<\/style/iu);
      // Parsing both forms normalizes CSS escapes without changing the value.
      expect(transformSync(escaped, { loader: "css" }).code).toBe(
        transformSync(css, { loader: "css" }).code
      );
    }
  );
});
