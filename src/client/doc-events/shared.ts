/** `el.closest(sel)` narrowed to HTMLElement — misses and non-HTML hits (SVG) are null. */
export const closestEl = (el: Element, sel: string): HTMLElement | null => {
  const hit = el.closest(sel);
  return hit instanceof HTMLElement ? hit : null;
};

// Flashes a feedback state on a button: swaps to the .mdxr-copy-done icon /
// label and tints it via .copied (success) or shakes it red via
// .copy-failed. A repeat click restarts the pop (reflow) and the timer.
export const flash = (
  b: HTMLElement,
  cls: "copied" | "copy-failed",
  label?: string
): void => {
  const ex = b as HTMLElement & {
    mdxrLabel?: null | string;
    mdxrTimer?: ReturnType<typeof setTimeout>;
  };
  clearTimeout(ex.mdxrTimer);
  if (label !== undefined) {
    ex.mdxrLabel ??= b.getAttribute("aria-label");
    b.setAttribute("aria-label", label);
  }
  b.classList.remove("copied", "copy-failed");
  void b.offsetWidth;
  b.classList.add(cls);
  ex.mdxrTimer = setTimeout(() => {
    b.classList.remove(cls);
    if (ex.mdxrLabel !== undefined) {
      if (ex.mdxrLabel === null) {
        b.removeAttribute("aria-label");
      } else {
        b.setAttribute("aria-label", ex.mdxrLabel);
      }
      ex.mdxrLabel = undefined;
    }
  }, 1600);
};

export const writeClipboard = (
  text: string,
  done: () => void,
  fail: () => void
): void => {
  const legacy = (): boolean => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      // oxlint-disable-next-line typescript/no-deprecated -- only fallback outside secure contexts
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  };
  // navigator.clipboard is absent outside secure contexts (e.g. file://).
  const clip = navigator.clipboard as Clipboard | undefined;
  if (clip === undefined) {
    if (legacy()) {
      done();
    } else {
      fail();
    }
    return;
  }
  void (async () => {
    try {
      await clip.writeText(text);
      done();
    } catch {
      if (legacy()) {
        done();
      } else {
        fail();
      }
    }
  })();
};

// Writes `text` to the clipboard and flashes `btn` accordingly; labels are
// optional so icon-only buttons can omit them.
export const copyWithFeedback = (
  btn: HTMLElement,
  text: string,
  doneLabel?: string,
  failLabel?: string
): void => {
  writeClipboard(
    text,
    () => {
      flash(btn, "copied", doneLabel);
    },
    () => {
      flash(btn, "copy-failed", failLabel);
    }
  );
};
