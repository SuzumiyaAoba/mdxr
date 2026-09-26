import { parseAnnotationDocument } from "../annotations.js";
import { parseSectionReviews } from "../section-reviews.js";

interface ReviewControl {
  button: HTMLButtonElement;
  id: string;
  label: HTMLElement;
  revision: string;
  status: HTMLElement;
  tab: HTMLElement | null;
  title: string;
}

const reviewControl = (
  host: HTMLElement,
  template: HTMLTemplateElement
): ReviewControl | undefined => {
  const {
    sectionId: id,
    sectionRevision: revision,
    sectionTitle,
  } = host.dataset;
  if (id === undefined || revision === undefined || host.shadowRoot !== null) {
    return undefined;
  }
  const shadow = host.attachShadow({ mode: "open" });
  shadow.append(template.content.cloneNode(true));
  const button = shadow.querySelector("button");
  const label = shadow.querySelector<HTMLElement>(
    "[data-section-review-label]"
  );
  const status = shadow.querySelector<HTMLElement>('[role="status"]');
  if (button === null || label === null || status === null) {
    return undefined;
  }
  const page = host.closest<HTMLElement>("[data-mdxr-page]");
  const tab = document.querySelector<HTMLElement>(
    `#${CSS.escape(`mdxr-page-tab:${page?.dataset.mdxrPage}`)}`
  );
  const icon = shadow.querySelector("[data-section-review-icon]");
  if (icon !== null) {
    tab?.append(icon.cloneNode(true));
  }
  return {
    button,
    id,
    label,
    revision,
    status,
    tab,
    title: sectionTitle ?? id,
  };
};

class SectionReviews {
  private readonly controls: ReviewControl[] = [];
  private readonly storageKey: string;
  private readonly summary: HTMLElement | null;
  private reviews = new Map<string, string>();
  private storageAvailable = true;

  constructor(root: HTMLElement, template: HTMLTemplateElement, file: string) {
    this.storageKey = `mdxr:section-reviews:v1:${file}`;
    this.summary = document.querySelector("[data-section-review-summary]");
    this.load();
    for (const host of root.querySelectorAll<HTMLElement>(
      "mdxr-section-review"
    )) {
      const control = reviewControl(host, template);
      if (control === undefined) {
        continue;
      }
      this.controls.push(control);
      control.button.addEventListener("click", () => {
        this.toggle(control);
      });
    }
    this.refresh();
    window.addEventListener("storage", (event) => {
      if (event.key === this.storageKey || event.key === null) {
        this.load();
        this.refresh();
      }
    });
  }

  private load(): void {
    if (!this.storageAvailable) {
      return;
    }
    try {
      this.reviews = new Map(
        parseSectionReviews(localStorage.getItem(this.storageKey)).map(
          ({ id, revision }) => [id, revision]
        )
      );
    } catch {
      // Preserve corrupt records instead of silently overwriting user data.
      this.storageAvailable = false;
    }
  }

  private save(): void {
    if (!this.storageAvailable) {
      return;
    }
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({
          sections: [...this.reviews].map(([id, revision]) => ({
            id,
            revision,
          })),
          version: 1,
        })
      );
    } catch {
      this.storageAvailable = false;
    }
  }

  private toggle(control: ReviewControl): void {
    // Merge the latest saved state so reviewing in another tab is retained.
    const reviewed = this.reviews.get(control.id) === control.revision;
    this.load();
    if (reviewed) {
      this.reviews.delete(control.id);
    } else {
      this.reviews.set(control.id, control.revision);
    }
    this.save();
    if (!this.storageAvailable) {
      control.status.textContent = "Not saved";
      control.button.setAttribute("aria-describedby", control.status.id);
    }
    this.refresh();
  }

  private refresh(): void {
    let count = 0;
    for (const control of this.controls) {
      const reviewed = this.reviews.get(control.id) === control.revision;
      const label = reviewed ? "Reviewed" : "Not reviewed";
      count += Number(reviewed);
      control.button.setAttribute("aria-pressed", String(reviewed));
      control.button.setAttribute("aria-label", `${label}: ${control.title}`);
      control.button.title = reviewed
        ? "Mark as not reviewed"
        : "Mark as reviewed";
      control.label.textContent = label;
      if (control.tab !== null) {
        control.tab.dataset.mdxrReviewed = String(reviewed);
        control.tab.setAttribute("aria-description", label);
      }
    }
    if (this.summary !== null) {
      this.summary.hidden = this.controls.length === 0;
      this.summary.textContent = `${count} / ${this.controls.length} sections reviewed`;
    }
  }
}

export const initSectionReviews = (): SectionReviews | undefined => {
  const root = document.querySelector<HTMLElement>("#mdxr-root");
  const data = document.querySelector("#mdxr-annotation-document");
  const template = document.querySelector<HTMLTemplateElement>(
    "#mdxr-section-review-template"
  );
  if (
    root === null ||
    data === null ||
    template === null ||
    root.querySelector("mdxr-section-review") === null
  ) {
    return undefined;
  }
  // Review features share the document identity emitted by render().
  const info = parseAnnotationDocument(data.textContent ?? "{}");
  if (info !== undefined) {
    return new SectionReviews(root, template, info.file);
  }
  return undefined;
};
