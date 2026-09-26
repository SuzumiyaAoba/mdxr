/** Shadow DOM keeps review controls independent of MDX hydration and selection. */
export const sectionReviewHtml = (icon: (name: string) => string): string => `
<template id="mdxr-section-review-template">
  <style>
    :host {
      display: block;
      color: var(--muted-foreground, #737373);
      font: 0.75rem/1.5 var(--font-sans, ui-sans-serif, system-ui, sans-serif);
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      min-height: 2rem;
      padding: 0.25rem 0.625rem;
      border: 1px solid var(--border, #e5e5e5);
      border-radius: 999px;
      background: var(--background, #fff);
      color: inherit;
      font: inherit;
      white-space: nowrap;
      cursor: pointer;
    }
    button:hover { background: var(--accent, #f5f5f5); }
    button:focus-visible {
      outline: 2px solid var(--ring, #737373);
      outline-offset: 3px;
    }
    button[aria-pressed="true"] {
      color: var(--mdxr-review-success, #047857);
      border-color: currentColor;
    }
    svg { display: block; width: 1rem; height: 1rem; }
    .mdxr-review-done { display: none; }
    button[aria-pressed="true"] .mdxr-review-done { display: block; }
    button[aria-pressed="true"] .mdxr-review-pending { display: none; }
    [role="status"] { display: inline-block; margin-inline-start: 0.5rem; }
    [role="status"]:empty { display: none; }
    @media print { :host { display: none; } }
  </style>
  <button type="button" aria-pressed="false"><span data-section-review-icon aria-hidden="true"><span class="mdxr-review-pending">${icon("circle")}</span><span class="mdxr-review-done">${icon("circle-check")}</span></span><span data-section-review-label>Not reviewed</span></button>
  <span id="save-status" role="status" title="Review status will be lost after reloading or closing this page."></span>
</template>`;
