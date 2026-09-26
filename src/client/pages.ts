interface DocumentPage {
  element: HTMLElement;
  tab: HTMLButtonElement;
  target: HTMLElement;
}

const scrollToTarget = (target: HTMLElement): void => {
  // Page wrappers use display:contents in continuous view and have no box.
  const visible = Object.hasOwn(target.dataset, "mdxrPage")
    ? (target.firstElementChild ?? target)
    : target;
  visible.scrollIntoView({ behavior: "instant", block: "start" });
};

const hashTarget = (hash: string): HTMLElement | null => {
  try {
    return hash === ""
      ? null
      : document.querySelector<HTMLElement>(
          `#${CSS.escape(decodeURIComponent(hash.slice(1)))}`
        );
  } catch {
    return null;
  }
};

const storedView = (): boolean => {
  try {
    return localStorage.getItem("mdxr-view") === "pages";
  } catch {
    return false;
  }
};

const storeView = (paged: boolean): void => {
  try {
    localStorage.setItem("mdxr-view", paged ? "pages" : "document");
  } catch {
    // file:// and private contexts may disable storage; switching still works.
  }
};

const pageTabs = (root: HTMLElement, tabs: HTMLElement): DocumentPage[] =>
  [...root.querySelectorAll<HTMLElement>("[data-mdxr-page]")].map(
    (element, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.id = `mdxr-page-tab:${index}`;
      tab.textContent = element.dataset.mdxrPageTitle ?? `Section ${index + 1}`;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", "mdxr-content");
      tabs.append(tab);
      return {
        element,
        tab,
        target: element.querySelector<HTMLElement>("h1[id],h2[id]") ?? element,
      };
    }
  );

class PageNavigation {
  private readonly pages: DocumentPage[];
  private readonly content: HTMLElement;
  private readonly controls: HTMLElement;
  private readonly sidebar: HTMLElement;
  private readonly visibility = document.createElement("style");
  private active = 0;
  private paged = false;

  constructor(
    root: HTMLElement,
    content: HTMLElement,
    controls: HTMLElement,
    sidebar: HTMLElement,
    tabs: HTMLElement
  ) {
    this.content = content;
    this.controls = controls;
    this.sidebar = sidebar;
    this.pages = pageTabs(root, tabs);
    document.head.append(this.visibility);
    this.bindEvents();
    controls.hidden = false;
    this.active = this.pageOf(hashTarget(location.hash)) ?? 0;
    this.setView(storedView());
    this.revealHash();
  }

  private pageOf(target: Element | null): number | undefined {
    const index = this.pages.findIndex((page) =>
      target === null ? false : page.element.contains(target)
    );
    return index === -1 ? undefined : index;
  }

  private select(index: number): void {
    const page = this.pages[index];
    if (page === undefined) {
      return;
    }
    this.active = index;
    // Keep all DOM owned by React untouched, including attributes. The rule
    // only applies on screen, so printing always includes the whole document.
    this.visibility.textContent = this.paged
      ? `@media screen { #mdxr-root [data-mdxr-page]:not([data-mdxr-page="${index}"]) { display: none; } }`
      : "";
    for (const [i, item] of this.pages.entries()) {
      item.tab.setAttribute("aria-selected", String(i === index));
      item.tab.tabIndex = i === index ? 0 : -1;
    }
    if (this.paged) {
      this.content.setAttribute("aria-labelledby", page.tab.id);
    }
    document.dispatchEvent(new Event("mdxr:pagechange"));
  }

  private setView(paged: boolean): void {
    this.paged = paged;
    document.body.dataset.mdxrView = paged ? "pages" : "document";
    this.sidebar.hidden = !paged;
    for (const button of this.controls.querySelectorAll("button")) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.mdxrView === document.body.dataset.mdxrView)
      );
    }
    if (paged) {
      this.content.setAttribute("role", "tabpanel");
      this.content.tabIndex = 0;
    } else {
      for (const attr of ["role", "aria-labelledby", "tabindex"]) {
        this.content.removeAttribute(attr);
      }
    }
    this.select(this.active);
  }

  private open(index: number): void {
    this.select(index);
    const page = this.pages[index];
    if (page === undefined) {
      return;
    }
    const hash = `#${encodeURIComponent(page.target.id)}`;
    if (location.hash !== hash) {
      // pushState also works for standalone files; blocked history must not
      // prevent page navigation (for example in a sandboxed iframe).
      try {
        history.pushState(null, "", hash);
      } catch {
        // The current selection still works without a shareable URL.
      }
    }
    scrollToTarget(this.content);
  }

  private reveal(target: Element | null): void {
    const index = this.pageOf(target);
    if (this.paged && index !== undefined) {
      this.select(index);
    }
  }

  private revealHash(): void {
    if (this.paged && location.hash === "") {
      this.select(0);
      scrollToTarget(this.content);
      return;
    }
    const target = hashTarget(location.hash);
    this.reveal(target);
    if (this.paged && target !== null) {
      scrollToTarget(target);
    }
  }

  private switchView(paged: boolean): void {
    if (paged === this.paged) {
      return;
    }
    if (paged) {
      // Resume at the section being read in the continuous document.
      this.active = Math.max(
        0,
        this.pages.findLastIndex(
          (page) => page.target.getBoundingClientRect().top <= 100
        )
      );
    }
    this.setView(paged);
    storeView(paged);
    if (paged) {
      scrollToTarget(this.content);
    } else {
      const page = this.pages[this.active];
      if (page !== undefined) {
        scrollToTarget(page.target);
      }
    }
  }

  private followLink(event: MouseEvent): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      !(event.target instanceof Element)
    ) {
      return;
    }
    const link = event.target.closest("a");
    if (
      !(link instanceof HTMLAnchorElement) ||
      link.hasAttribute("download") ||
      (link.target !== "" && link.target !== "_self")
    ) {
      return;
    }
    const url = new URL(link.href);
    if (
      url.origin === location.origin &&
      url.pathname === location.pathname &&
      url.search === location.search &&
      url.hash !== ""
    ) {
      this.reveal(hashTarget(url.hash));
    }
  }

  private bindEvents(): void {
    for (const button of this.controls.querySelectorAll("button")) {
      button.addEventListener("click", () => {
        this.switchView(button.dataset.mdxrView === "pages");
      });
    }
    for (const [index, page] of this.pages.entries()) {
      page.tab.addEventListener("click", () => {
        this.open(index);
      });
      page.tab.addEventListener("keydown", (event) => {
        const last = this.pages.length - 1;
        const next: Record<string, number> = {
          ArrowDown: index === last ? 0 : index + 1,
          ArrowUp: index === 0 ? last : index - 1,
          End: last,
          Home: 0,
        };
        const target = next[event.key];
        if (target !== undefined) {
          event.preventDefault();
          this.open(target);
          this.pages[target]?.tab.focus();
        }
      });
    }
    document.addEventListener("click", (event) => {
      this.followLink(event);
    });
    window.addEventListener("hashchange", () => {
      this.revealHash();
    });
    document.addEventListener("mdxr:reveal", (event) => {
      if (event.target instanceof Element) {
        this.reveal(event.target);
      }
    });
  }
}

export const initPages = (): PageNavigation | undefined => {
  const root = document.querySelector<HTMLElement>("#mdxr-root");
  const content = document.querySelector<HTMLElement>("#mdxr-content");
  const controls = document.querySelector<HTMLElement>(".mdxr-view-controls");
  const sidebar = document.querySelector<HTMLElement>(".mdxr-pages");
  const tabs = document.querySelector<HTMLElement>("[data-mdxr-page-tabs]");
  if (
    root === null ||
    content === null ||
    controls === null ||
    sidebar === null ||
    tabs === null ||
    root.querySelector("[data-mdxr-page]") === null
  ) {
    return undefined;
  }
  return new PageNavigation(root, content, controls, sidebar, tabs);
};
