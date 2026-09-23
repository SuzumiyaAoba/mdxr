/**
 * Table of contents with active-anchor tracking and depth-aware line styling.
 * Adapted from the Crux UI / ABUI registry (`@abui/toc`), itself derived from
 * fumadocs' TOC. Two list variants: `TOCItems` (straight line) and
 * `ClerkTOCItems` (line that follows the heading hierarchy).
 */
import { cn } from "cn";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ComponentProps,
  HTMLAttributes,
  ReactNode,
  Ref,
  RefCallback,
  RefObject,
} from "react";

export interface TOCItemType {
  title: ReactNode;
  url: string;
  depth: number;
}

export type TableOfContents = TOCItemType[];

const ActiveAnchorContext = createContext<string[]>([]);
const ScrollContext = createContext<RefObject<HTMLElement | null>>({
  current: null,
});
const TOCContext = createContext<TOCItemType[]>([]);

/** The ids of visible anchors. */
export const useActiveAnchors = (): string[] => useContext(ActiveAnchorContext);

/** The estimated active heading id. */
export const useActiveAnchor = (): string | undefined =>
  useContext(ActiveAnchorContext)[0];

export const useTOCItems = (): TOCItemType[] => useContext(TOCContext);

const mergeRefs =
  <T,>(...refs: (Ref<T> | undefined)[]): RefCallback<T> =>
  (value) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref !== null && ref !== undefined) {
        ref.current = value;
      }
    }
  };

/** Track which of the `watch` heading ids are on screen. */
const useAnchorObserver = (watch: string[], single: boolean): string[] => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleRef = useRef(new Set<string>());
  const [activeAnchor, setActiveAnchor] = useState<string[]>([]);

  const onChange = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const visible = visibleRef.current;
      for (const entry of entries) {
        if (entry.isIntersecting) {
          visible.add(entry.target.id);
        } else {
          visible.delete(entry.target.id);
        }
      }

      if (visible.size > 0) {
        const items = watch.filter((item) => visible.has(item));
        setActiveAnchor(single ? items.slice(0, 1) : items);
        return;
      }

      // Nothing visible (between two long sections): fall back to the
      // heading closest to the top of the viewport.
      const viewTop = entries[0]?.rootBounds?.top ?? 0;
      let fallback: Element | undefined;
      let min = -1;
      for (const id of watch) {
        const element = document.getElementById(id);
        if (element === null) {
          continue;
        }
        const d = Math.abs(viewTop - element.getBoundingClientRect().top);
        if (min === -1 || d < min) {
          fallback = element;
          min = d;
        }
      }
      setActiveAnchor(fallback === undefined ? [] : [fallback.id]);
    },
    [watch, single]
  );

  useEffect(() => {
    if (observerRef.current !== null) {
      return;
    }
    observerRef.current = new IntersectionObserver(onChange, {
      rootMargin: "0px",
      threshold: 0.98,
    });
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [onChange]);

  useEffect(() => {
    const observer = observerRef.current;
    if (observer === null) {
      return;
    }
    const elements = watch.flatMap(
      (heading) => document.getElementById(heading) ?? []
    );
    for (const element of elements) {
      observer.observe(element);
    }
    return () => {
      for (const element of elements) {
        observer.unobserve(element);
      }
    };
  }, [watch]);

  return activeAnchor;
};

export interface TOCProviderProps {
  toc: TableOfContents;
  /** Only accept one active item at most. @defaultValue false */
  single?: boolean;
  children?: ReactNode;
}

export const TOCProvider = ({
  toc,
  single = false,
  children,
}: TOCProviderProps) => {
  const headings = useMemo(
    () => toc.map((item) => item.url.split("#")[1] ?? ""),
    [toc]
  );
  const activeAnchors = useAnchorObserver(headings, single);

  return (
    <TOCContext.Provider value={toc}>
      <ActiveAnchorContext.Provider value={activeAnchors}>
        {children}
      </ActiveAnchorContext.Provider>
    </TOCContext.Provider>
  );
};

/** Scrollable container; the first active item is kept in view. */
export const TOCScrollArea = ({
  ref,
  className,
  children,
  ...props
}: ComponentProps<"div">) => {
  const viewRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={cn(
        "relative ms-px min-h-0 [scrollbar-width:none] overflow-auto [mask-image:linear-gradient(to_bottom,transparent,white_16px,white_calc(100%-16px),transparent)] py-3 text-sm",
        className
      )}
      ref={mergeRefs(viewRef, ref)}
      {...props}
    >
      <ScrollContext.Provider value={viewRef}>
        {children}
      </ScrollContext.Provider>
    </div>
  );
};

type TocThumbValues = [top: number, height: number];

interface TocThumbProps extends HTMLAttributes<HTMLDivElement> {
  containerRef: RefObject<HTMLElement | null>;
}

const calcThumb = (
  container: HTMLElement,
  active: string[]
): TocThumbValues => {
  if (active.length === 0 || container.clientHeight === 0) {
    return [0, 0];
  }

  let upper = Number.MAX_VALUE;
  let lower = 0;
  for (const item of active) {
    const element = container.querySelector<HTMLElement>(
      `a[href="#${CSS.escape(item)}"]`
    );
    if (element === null) {
      continue;
    }
    const styles = getComputedStyle(element);
    upper = Math.min(
      upper,
      element.offsetTop + Number.parseFloat(styles.paddingTop)
    );
    lower = Math.max(
      lower,
      element.offsetTop +
        element.clientHeight -
        Number.parseFloat(styles.paddingBottom)
    );
  }
  return [upper, lower - upper];
};

const updateThumb = (element: HTMLElement, [top, height]: TocThumbValues) => {
  element.style.setProperty("--toc-top", `${top}px`);
  element.style.setProperty("--toc-height", `${height}px`);
};

/** Active indicator that slides alongside the visible entries. */
const TocThumb = ({ containerRef, ...props }: TocThumbProps) => {
  const thumbRef = useRef<HTMLDivElement>(null);
  const active = useActiveAnchors();

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const onUpdate = () => {
      if (thumbRef.current !== null) {
        updateThumb(thumbRef.current, calcThumb(container, active));
      }
    };
    const observer = new ResizeObserver(onUpdate);
    observer.observe(container);
    onUpdate();
    return () => {
      observer.disconnect();
    };
  }, [containerRef, active]);

  return <div ref={thumbRef} role="none" {...props} />;
};

export interface TOCItemProps extends Omit<ComponentProps<"a">, "href"> {
  href: string;
  onActiveChange?: (v: boolean) => void;
}

export const TOCItem = ({
  ref,
  onActiveChange,
  children,
  ...props
}: TOCItemProps) => {
  const containerRef = useContext(ScrollContext);
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const activeAnchors = useActiveAnchors();
  const activeOrder = activeAnchors.indexOf(props.href.slice(1));
  const isActive = activeOrder !== -1;
  const shouldScroll = activeOrder === 0;

  // Keep the first active entry visible inside the scroll area — scrolls only
  // the container (never the page), and only when the entry is out of view.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const container = containerRef.current;
    if (
      container === null ||
      anchor === null ||
      !shouldScroll ||
      !anchor.isConnected
    ) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const outOfView =
      anchorRect.top < containerRect.top ||
      anchorRect.bottom > containerRect.bottom;
    if (!outOfView) {
      return;
    }
    const anchorCenter =
      anchor.offsetTop - container.offsetTop + anchor.offsetHeight / 2;
    container.scrollTo({
      behavior: "smooth",
      top: Math.max(0, anchorCenter - container.clientHeight / 2),
    });
  }, [containerRef, shouldScroll]);

  useEffect(() => {
    onActiveChange?.(isActive);
  }, [isActive, onActiveChange]);

  return (
    <a data-active={isActive} ref={mergeRefs(anchorRef, ref)} {...props}>
      {children}
    </a>
  );
};

const EMPTY_CLS = "rounded-lg border bg-card p-3 text-xs text-muted-foreground";

const ITEM_CLS =
  "py-1.5 text-sm text-muted-foreground transition-colors [overflow-wrap:anywhere] first:pt-0 last:pb-0 hover:text-accent-foreground data-[active=true]:text-primary";

export interface TOCItemsProps extends ComponentProps<"div"> {
  /** Text shown when there are no headings. @defaultValue "No Headings" */
  emptyText?: string;
}

const SimpleTOCItem = ({ item }: { item: TOCItemType }) => (
  <TOCItem
    className={cn(
      ITEM_CLS,
      item.depth <= 2 && "ps-3",
      item.depth === 3 && "ps-6",
      item.depth >= 4 && "ps-8"
    )}
    href={item.url}
  >
    {item.title}
  </TOCItem>
);

/** TOC list with a straight border line. */
export const TOCItems = ({
  ref,
  className,
  emptyText = "No Headings",
  ...props
}: TOCItemsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const items = useTOCItems();

  if (items.length === 0) {
    return <div className={EMPTY_CLS}>{emptyText}</div>;
  }

  return (
    <>
      <TocThumb
        className="bg-primary absolute top-(--toc-top) h-(--toc-height) w-px transition-all"
        containerRef={containerRef}
      />
      <div
        className={cn("border-foreground/10 flex flex-col border-s", className)}
        ref={mergeRefs(ref, containerRef)}
        {...props}
      >
        {items.map((item) => (
          <SimpleTOCItem item={item} key={item.url} />
        ))}
      </div>
    </>
  );
};

const getItemOffset = (depth: number): number => {
  if (depth <= 2) {
    return 14;
  }
  return depth === 3 ? 26 : 36;
};

const getLineOffset = (depth: number): number => (depth >= 3 ? 10 : 0);

interface ClerkLine {
  path: string;
  width: number;
  height: number;
}

/** One vertical segment per entry, shifted right for nested headings. */
const clerkLine = (container: HTMLElement, items: TOCItemType[]): ClerkLine => {
  let width = 0;
  let height = 0;
  const d: string[] = [];
  for (const [i, item] of items.entries()) {
    const element = container.querySelector<HTMLElement>(
      `a[href="${CSS.escape(item.url)}"]`
    );
    if (element === null) {
      continue;
    }
    const styles = getComputedStyle(element);
    const offset = getLineOffset(item.depth) + 1;
    const top = element.offsetTop + Number.parseFloat(styles.paddingTop);
    const bottom =
      element.offsetTop +
      element.clientHeight -
      Number.parseFloat(styles.paddingBottom);
    width = Math.max(offset, width);
    height = Math.max(height, bottom);
    d.push(`${i === 0 ? "M" : "L"}${offset} ${top}`, `L${offset} ${bottom}`);
  }
  return { height, path: d.join(" "), width: width + 1 };
};

const ClerkTOCItemElement = ({
  item,
  upper = item.depth,
  lower = item.depth,
}: {
  item: TOCItemType;
  upper?: number;
  lower?: number;
}) => {
  const offset = getLineOffset(item.depth);
  const upperOffset = getLineOffset(upper);
  const lowerOffset = getLineOffset(lower);

  return (
    <TOCItem
      className={cn("relative", ITEM_CLS)}
      href={item.url}
      style={{ paddingInlineStart: getItemOffset(item.depth) }}
    >
      {offset === upperOffset ? null : (
        <svg
          aria-hidden="true"
          className="absolute start-0 -top-1.5 size-4 rtl:-scale-x-100"
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line
            className="stroke-foreground/10"
            strokeWidth="1"
            x1={upperOffset}
            x2={offset}
            y1="0"
            y2="12"
          />
        </svg>
      )}
      <div
        className={cn(
          "bg-foreground/10 absolute inset-y-0 w-px",
          offset !== upperOffset && "top-1.5",
          offset !== lowerOffset && "bottom-1.5"
        )}
        style={{ insetInlineStart: offset }}
      />
      {item.title}
    </TOCItem>
  );
};

/** TOC list whose line bends to follow the heading hierarchy. */
export const ClerkTOCItems = ({
  ref,
  className,
  emptyText = "No Headings",
  ...props
}: TOCItemsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const items = useTOCItems();
  const [svg, setSvg] = useState<ClerkLine>();

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const onResize = () => {
      if (container.clientHeight > 0) {
        setSvg(clerkLine(container, items));
      }
    };
    const observer = new ResizeObserver(onResize);
    onResize();
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [items]);

  if (items.length === 0) {
    return <div className={EMPTY_CLS}>{emptyText}</div>;
  }

  const mask = svg && {
    height: svg.height,
    maskImage: `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svg.width} ${svg.height}"><path d="${svg.path}" stroke="black" stroke-width="1" fill="none" /></svg>`
    )}")`,
    width: svg.width,
  };

  return (
    <>
      {mask ? (
        <div className="absolute start-0 top-0 rtl:-scale-x-100" style={mask}>
          <TocThumb
            className="bg-primary mt-(--toc-top) h-(--toc-height) transition-all"
            containerRef={containerRef}
          />
        </div>
      ) : null}
      <div
        className={cn("flex flex-col", className)}
        ref={mergeRefs(containerRef, ref)}
        {...props}
      >
        {items.map((item, i) => (
          <ClerkTOCItemElement
            item={item}
            key={item.url}
            lower={items[i + 1]?.depth}
            upper={items[i - 1]?.depth}
          />
        ))}
      </div>
    </>
  );
};

export const PageTOC = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("flex flex-col gap-3", className)} {...props} />
);

export interface PageTOCItemsProps extends TOCItemsProps {
  /**
   * - "default": straight border line
   * - "clerk": depth-aware line that follows the hierarchy
   * @defaultValue "default"
   */
  variant?: "default" | "clerk";
}

export const PageTOCItems = ({
  variant = "default",
  ...props
}: PageTOCItemsProps) => (
  <TOCScrollArea>
    {variant === "clerk" ? (
      <ClerkTOCItems {...props} />
    ) : (
      <TOCItems {...props} />
    )}
  </TOCScrollArea>
);
