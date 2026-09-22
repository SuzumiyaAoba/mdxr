import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  Calculator,
  Checklist,
  PromptTemplate,
  Wizard,
} from "../src/ui/document-inputs.js";
import { PrintLayout } from "../src/ui/document-media.js";
import { CodeWalkthrough, PackageInstall } from "../src/ui/document-tabs.js";

describe("document input boundaries", () => {
  it("accepts bare keep-together flags for print layout", () => {
    const html = renderToStaticMarkup(
      createElement(PrintLayout, { keepTogether: true }, "Content")
    );
    expect(html).toContain("print:break-inside-avoid");
  });

  it.each([{}, { type: "textarea" }, { options: "Yes, No" }])(
    "honors required string values in wizard records (%j)",
    (field) => {
      const html = renderToStaticMarkup(
        createElement(Wizard, {
          data: JSON.stringify([
            { name: "answer", required: "true", ...field },
          ]),
        })
      );
      expect(html).toContain('required=""');
    }
  );

  it.each(["constructor", "toString", "__proto__"])(
    "uses explicit calculator values for %s",
    (name) => {
      const html = renderToStaticMarkup(
        createElement(Calculator, {
          data: JSON.stringify([{ name, value: 5 }]),
        })
      );
      expect(html).toMatch(/<output[^>]*>5<\/output>/u);
    }
  );

  it("does not precheck a prototype-named checklist item", () => {
    const html = renderToStaticMarkup(
      createElement(Checklist, {
        data: JSON.stringify([{ id: "constructor", label: "Task" }]),
      })
    );
    expect(html).toContain("0 / 1 completed");
    expect(html).not.toContain('checked=""');
  });

  it("keeps prototype-named wizard answers empty", () => {
    const html = renderToStaticMarkup(
      createElement(Wizard, {
        data: JSON.stringify([{ label: "Answer", name: "constructor" }]),
      })
    );
    expect(html).toContain('value=""');
    expect(html).not.toContain("function Object");
  });

  it("substitutes only declared prompt variables", () => {
    const html = renderToStaticMarkup(
      createElement(PromptTemplate, {
        data: JSON.stringify([{ name: "constructor", value: "provided" }]),
        template: "{{constructor}} {{toString}}",
      })
    );
    expect(html).toContain("provided {{toString}}");
    expect(html).not.toContain("function Object");
  });

  it("accepts bare dev flags for package installation", () => {
    const html = renderToStaticMarkup(
      createElement(PackageInstall, { dev: true, packages: "kit" })
    );
    expect(html).toContain("pnpm add -D kit");
  });

  it("reports zero steps for an empty code walkthrough", () => {
    const html = renderToStaticMarkup(createElement(CodeWalkthrough, {}));
    expect(html).toContain("0 / 0");
  });
});
