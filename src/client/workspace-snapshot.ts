import { escapeExportHtml } from "../workspace-export-html.js";

const CSS_URL =
  /url\(\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<bare>[^\s)]*))\s*\)/gu;
const CSS_IMPORT = /@import\s*(?:url\s*\(|["'])/iu;

const dataUrl = async (url: string): Promise<string> => {
  if (url.startsWith("data:") || url.startsWith("#")) {
    return url;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not embed document asset: ${url}`);
  }
  const blob = await response.blob();
  const { hash } = new URL(url);
  // FileReader exposes events rather than a promise-based data URL API.
  // oxlint-disable-next-line promise/avoid-new
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(`${reader.result}${hash}`);
      } else {
        reject(new Error(`Could not read document asset: ${url}`));
      }
    });
    reader.addEventListener("error", () => {
      reject(new Error(`Could not read document asset: ${url}`));
    });
    reader.readAsDataURL(blob);
  });
};

const embedCss = async (css: string, base: string): Promise<string> => {
  if (CSS_IMPORT.test(css.replaceAll(/\/\*[\s\S]*?\*\//gu, ""))) {
    throw new Error(
      "Cannot export a stylesheet containing @import. Bundle the imported styles before exporting."
    );
  }
  const matches = [...css.matchAll(CSS_URL)];
  const replacements = await Promise.all(
    matches.map(async (match) => {
      const url =
        match.groups?.double ??
        match.groups?.single ??
        match.groups?.bare ??
        "";
      return url === "" || url.startsWith("#") || url.startsWith("data:")
        ? match[0]
        : `url("${await dataUrl(new URL(url, base).href)}")`;
    })
  );
  let index = 0;
  return css.replaceAll(CSS_URL, () => {
    const replacement = replacements[index] ?? "";
    index += 1;
    return replacement;
  });
};

const copyElementState = (node: Element, clone: Element): void => {
  if (node instanceof HTMLInputElement) {
    if (node.type === "file") {
      clone.removeAttribute("value");
    } else {
      clone.setAttribute("value", node.value);
    }
    clone.toggleAttribute("checked", node.checked);
  } else if (node instanceof HTMLTextAreaElement) {
    clone.textContent = node.value;
  } else if (node instanceof HTMLOptionElement) {
    clone.toggleAttribute("selected", node.selected);
  } else if (node instanceof HTMLImageElement) {
    clone.setAttribute("src", node.currentSrc || node.src);
    clone.removeAttribute("srcset");
    clone.removeAttribute("loading");
  }
  if (clone.matches("[data-mdxr-page]")) {
    clone.removeAttribute("hidden");
    clone.removeAttribute("inert");
  }
  if (clone.matches("#mdxr-prelude")) {
    clone.removeAttribute("hidden");
  }
};

/** Clone the rendered state, including native form values and open shadow DOM. */
const cloneSnapshot = (node: Node): Node => {
  if (node instanceof HTMLScriptElement) {
    return document.createTextNode("");
  }
  if (node instanceof HTMLCanvasElement) {
    const image = document.createElement("img");
    image.src = node.toDataURL();
    image.alt = node.getAttribute("aria-label") ?? "Canvas snapshot";
    return image;
  }
  const clone = node.cloneNode(false);
  if (!(node instanceof Element) || !(clone instanceof Element)) {
    return clone;
  }
  for (const child of node.childNodes) {
    clone.append(cloneSnapshot(child));
  }
  for (const attribute of clone.getAttributeNames()) {
    if (attribute.toLowerCase().startsWith("on")) {
      clone.removeAttribute(attribute);
    }
  }
  if (node.shadowRoot !== null) {
    const template = document.createElement("template");
    template.setAttribute("shadowrootmode", "open");
    for (const child of node.shadowRoot.childNodes) {
      template.content.append(cloneSnapshot(child));
    }
    clone.prepend(template);
  }
  copyElementState(node, clone);
  return clone;
};

const embedStylesheet = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not embed stylesheet: ${url}`);
  }
  return await embedCss(await response.text(), url);
};

const embedElements = async (
  root: ParentNode,
  base = document.baseURI
): Promise<void> => {
  await Promise.all(
    [...root.querySelectorAll('link[rel="stylesheet"]')].map(async (link) => {
      const href = link.getAttribute("href");
      if (href === null) {
        return;
      }
      const style = document.createElement("style");
      style.textContent = await embedStylesheet(new URL(href, base).href);
      style.media = link.getAttribute("media") ?? "";
      link.replaceWith(style);
    })
  );
  await Promise.all(
    [...root.querySelectorAll("img, image, video, audio, source")].map(
      async (element) => {
        if (element.matches("picture source")) {
          element.remove();
          return;
        }
        await Promise.all(
          ["src", "href", "xlink:href", "poster"].map(async (attr) => {
            const value = element.getAttribute(attr);
            if (value !== null && value !== "") {
              element.setAttribute(
                attr,
                await dataUrl(new URL(value, base).href)
              );
            }
          })
        );
        element.removeAttribute("srcset");
      }
    )
  );
  await Promise.all(
    [...root.querySelectorAll("[style]")].map(async (element) => {
      element.setAttribute(
        "style",
        await embedCss(element.getAttribute("style") ?? "", base)
      );
    })
  );
  await Promise.all(
    [...root.querySelectorAll("style")].map(async (element) => {
      const css = await embedCss(element.textContent ?? "", base);
      element.textContent = css.replaceAll(/<\/style/giu, "<\\/style");
    })
  );
  await Promise.all(
    [...root.querySelectorAll("template")].map(async (template) => {
      await embedElements(template.content, base);
    })
  );
  // Frames cannot retain a dependency on a preview server or remote page.
  await Promise.all(
    [...root.querySelectorAll("iframe")].map(async (frame) => {
      if (!frame.hasAttribute("srcdoc") && frame.hasAttribute("src")) {
        throw new Error(
          "Cannot export an embedded frame with an external source. Use inline content before exporting."
        );
      }
      frame.setAttribute("sandbox", "");
      const content = frame.getAttribute("srcdoc");
      if (content !== null) {
        const parsed = new DOMParser().parseFromString(content, "text/html");
        const href = parsed.querySelector("base[href]")?.getAttribute("href");
        const frameBase =
          href === undefined || href === null ? base : new URL(href, base).href;
        for (const element of parsed.querySelectorAll("base, script")) {
          element.remove();
        }
        await embedElements(parsed, frameBase);
        frame.removeAttribute("src");
        frame.srcdoc = `<!doctype html>${parsed.documentElement.outerHTML}`;
      }
    })
  );
};

/** Capture synchronously, then inline assets without changing the live document. */
export const captureWorkspaceDocument = async (): Promise<string> => {
  const root = document.querySelector("#mdxr-root");
  if (root === null) {
    throw new Error("Document is not available for export");
  }
  const container = document.createElement("div");
  container.append(cloneSnapshot(root));
  const styles = [
    ...document.querySelectorAll("style, link[rel=stylesheet]"),
  ].map((element) => ({
    css:
      element instanceof HTMLStyleElement
        ? (element.textContent ?? "")
        : undefined,
    url: element instanceof HTMLLinkElement ? element.href : document.baseURI,
  }));
  const css = await Promise.all(
    styles.map(async (style) =>
      style.css === undefined
        ? await embedStylesheet(style.url)
        : await embedCss(style.css, style.url)
    )
  );
  await embedElements(container);
  const theme = document.documentElement.classList.contains("dark")
    ? "dark"
    : "";
  const safeCss = css.join("\n").replaceAll(/<\/style/giu, "<\\/style");
  return `<!doctype html><html lang="${escapeExportHtml(document.documentElement.lang || "en")}" class="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; media-src data:; font-src data:; style-src 'unsafe-inline';"><style>${safeCss}\n*,*::before,*::after{animation:none!important;transition:none!important}#mdxr-root{padding-top:2rem!important}[data-mdxr-page]{display:contents!important}</style></head><body class="${escapeExportHtml(document.body.className.replaceAll(/\bmdxr-[\w-]+\b/gu, ""))}">${container.innerHTML}</body></html>`;
};
