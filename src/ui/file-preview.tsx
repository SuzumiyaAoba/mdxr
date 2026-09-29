import { cn } from "cn";
import {
  CodeXml,
  ExternalLink,
  FileText,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { Button, buttonVariants } from "../components/ui/button.js";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog.js";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs.js";
import { fetchFilePreview } from "../file-preview-data.js";
import type { FilePreviewData } from "../file-preview-data.js";
import { parseLineRange } from "../lines.js";
import { WorkspaceCode } from "../workspace-code.js";
import type { SyntaxLines } from "../workspace-syntax.js";
import { CopyButton } from "./bits.js";
import { fileIcon } from "./file-icon.js";
import { linkTarget } from "./file-link.js";
import { Icon } from "./icon.js";
import { BORDER_CLS, SURFACE_CLS, TEXT, TONE_TEXT } from "./tones.js";

type PreviewState =
  | { status: "closed" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: FilePreviewData };

const ICON_BUTTON_CLS = `size-8 cursor-pointer rounded-md ${TEXT.muted} sm:size-7`;

const PREVIEW_TAB_CLS =
  "h-full flex-none rounded-none border-0 px-2 py-0 text-xs font-normal data-active:font-medium group-data-horizontal/tabs:after:bottom-0 group-data-horizontal/tabs:after:h-px";

const PreviewCopyButton = ({ source }: { source: string }) => (
  <CopyButton
    className={cn(
      buttonVariants({
        className: ICON_BUTTON_CLS,
        size: "icon",
        variant: "ghost",
      })
    )}
    copy={source}
    title="Copy contents"
  />
);

const PreviewError = ({
  message,
  markdown = false,
}: {
  message: string;
  markdown?: boolean;
}) => (
  <div
    role="alert"
    className="flex h-full items-center justify-center overflow-auto p-6"
  >
    <div className="flex max-w-lg items-start gap-2.5">
      <TriangleAlert
        aria-hidden="true"
        className={`mt-0.5 size-4 shrink-0 ${TONE_TEXT.amber}`}
      />
      <div className="min-w-0 space-y-1.5">
        <p className={`text-sm font-medium ${TEXT.code}`}>
          {markdown ? "Unable to render Markdown" : "Preview unavailable"}
        </p>
        <p className={`text-sm break-words whitespace-pre-wrap ${TEXT.muted}`}>
          {message}
        </p>
        {markdown && (
          <p className={`text-xs ${TEXT.muted}`}>
            Switch to Raw to view the source.
          </p>
        )}
      </div>
    </div>
  </div>
);

/** Fetch on activation; closing or reopening cancels the previous request. */
export const useFilePreview = () => {
  const [state, setState] = useState<PreviewState>({ status: "closed" });
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
    },
    []
  );

  const openPreview = async (url: string): Promise<void> => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ status: "loading" });
    try {
      const data = await fetchFilePreview(url, controller.signal);
      if (!controller.signal.aborted) {
        setState({ data, status: "ready" });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setState({
          error:
            error instanceof Error
              ? error.message
              : "Unable to load file preview",
          status: "error",
        });
      }
    }
  };

  const closePreview = (): void => {
    request.current?.abort();
    setState({ status: "closed" });
  };
  return { closePreview, openPreview, state };
};

const sourceLines = (source: string, syntax: SyntaxLines) => {
  let offset = 0;
  return source
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((text, index) => {
      const line = { number: index + 1, offset, syntax: syntax[index], text };
      offset += text.length + 1;
      return line;
    });
};

const PreviewCode = ({
  source,
  syntax,
  lines,
}: {
  source: string;
  syntax: SyntaxLines;
  lines?: string;
}) => {
  const pre = useRef<HTMLPreElement>(null);
  const range = lines === undefined ? undefined : parseLineRange(lines);
  const first = range?.start;
  useEffect(() => {
    if (first === undefined) {
      return;
    }
    const container = pre.current;
    const selected = container?.querySelector<HTMLElement>(".highlighted");
    if (container !== null && selected !== undefined && selected !== null) {
      container.scrollTop =
        selected.offsetTop -
        container.clientHeight / 2 +
        selected.offsetHeight / 2;
    }
  }, [first]);
  return (
    <pre
      aria-label="Source code"
      className="relative m-0 h-full min-h-0 overflow-auto overscroll-contain bg-white p-4 font-mono text-[0.8125rem] leading-6 text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
      ref={pre}
    >
      <code className="shiki has-line-numbers w-fit min-w-full">
        {sourceLines(source, syntax).map((line) => {
          const selected =
            range !== undefined &&
            line.number >= range.start &&
            (range.end === undefined || line.number <= range.end);
          return (
            <Fragment key={line.offset}>
              <span
                className={`line${selected ? " highlighted" : ""}`}
                data-line={line.number}
              >
                <WorkspaceCode text={line.text} syntax={line.syntax} />
              </span>
              {"\n"}
            </Fragment>
          );
        })}
      </code>
    </pre>
  );
};

const PreviewBody = ({
  data,
  path,
  lines,
}: {
  data: FilePreviewData;
  path: string;
  lines?: string;
}) => {
  if (data.kind === "image") {
    return (
      <div className="flex h-full min-h-0 items-center justify-center overflow-auto overscroll-contain p-4 sm:p-6">
        <img
          alt={path}
          src={data.src}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }
  if (data.kind === "text") {
    return (
      <PreviewCode source={data.source} syntax={data.syntax} lines={lines} />
    );
  }
  return (
    <>
      <TabsContent
        value="rendered"
        className="h-full min-h-0 overflow-auto overscroll-contain"
      >
        {data.html === undefined ? (
          <PreviewError
            markdown
            message={data.renderError ?? "Markdown preview is unavailable."}
          />
        ) : (
          <iframe
            className="block h-full w-full border-0 bg-white dark:bg-neutral-950"
            sandbox="allow-scripts"
            srcDoc={data.html}
            title={`Rendered ${path}`}
          />
        )}
      </TabsContent>
      <TabsContent value="raw" className="h-full min-h-0">
        <PreviewCode source={data.source} syntax={data.syntax} lines={lines} />
      </TabsContent>
    </>
  );
};

const FilePreviewContent = ({
  state,
  path,
  lines,
}: {
  state: PreviewState;
  path: string;
  lines?: string;
}) => {
  if (state.status === "closed") {
    return null;
  }
  if (state.status === "loading") {
    return (
      <output
        className={`flex h-full items-center justify-center gap-2 p-6 text-sm ${TEXT.muted}`}
      >
        <LoaderCircle
          aria-hidden="true"
          className="size-4 motion-safe:animate-spin"
        />
        Loading preview…
      </output>
    );
  }
  if (state.status === "error") {
    return <PreviewError message={state.error} />;
  }
  return <PreviewBody data={state.data} path={path} lines={lines} />;
};

const FilePreviewHeader = ({
  data,
  editor,
  lines,
  path,
}: {
  data?: FilePreviewData;
  editor?: string;
  lines?: string;
  path: string;
}) => {
  const normalizedPath = path.replaceAll("\\", "/");
  const lastSlash = normalizedPath.lastIndexOf("/");
  const directory = normalizedPath.slice(0, lastSlash + 1);
  const filename = normalizedPath.slice(lastSlash + 1);
  const markdown = data?.kind === "markdown";
  return (
    <div
      className={cn(
        `grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b px-3 ${BORDER_CLS} ${SURFACE_CLS} sm:px-4`,
        markdown && "sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
      )}
    >
      <div className="col-start-1 row-start-1 flex h-11 min-w-0 items-center gap-1.5">
        <Icon name={fileIcon(path)} className="size-3.5 shrink-0 opacity-70" />
        <DialogHeader className="min-w-0 gap-0">
          <DialogTitle
            className={`flex min-w-0 items-center font-mono text-xs leading-5 font-normal ${TEXT.code}`}
            title={path}
          >
            <span className={`hidden min-w-0 truncate sm:inline ${TEXT.muted}`}>
              {directory}
            </span>
            <span className="truncate">{filename}</span>
            {lines !== undefined && lines !== "" && (
              <span
                className={`shrink-0 ${TEXT.muted}`}
                title={`Lines ${lines}`}
              >
                :{lines}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Local file preview: {path}
          </DialogDescription>
        </DialogHeader>
        <CopyButton
          className={cn(
            buttonVariants({
              className: `size-6 shrink-0 cursor-pointer rounded ${TEXT.faint}`,
              size: "icon",
              variant: "ghost",
            })
          )}
          copy={path}
          title="Copy path"
        />
      </div>
      {markdown && (
        <TabsList
          aria-label="Markdown view"
          variant="line"
          className="col-span-2 col-start-1 row-start-2 gap-2 p-0 group-data-horizontal/tabs:h-9 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:group-data-horizontal/tabs:h-11"
        >
          <TabsTrigger value="rendered" className={PREVIEW_TAB_CLS}>
            <FileText aria-hidden="true" className="size-3.5" />
            Rendered
          </TabsTrigger>
          <TabsTrigger value="raw" className={PREVIEW_TAB_CLS}>
            <CodeXml aria-hidden="true" className="size-3.5" />
            Raw
          </TabsTrigger>
        </TabsList>
      )}
      <div
        className={cn(
          "col-start-2 row-start-1 flex items-center gap-0.5 justify-self-end",
          markdown && "sm:col-start-3"
        )}
      >
        {data !== undefined && data.kind !== "image" && (
          <PreviewCopyButton source={data.source} />
        )}
        {editor !== undefined && (
          <a
            aria-label="Open in editor"
            className={cn(
              buttonVariants({
                className: ICON_BUTTON_CLS,
                size: "icon",
                variant: "ghost",
              })
            )}
            href={editor}
            title="Open in editor"
            {...linkTarget(editor)}
          >
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        )}
        <DialogClose
          aria-label="Close"
          title="Close (Esc)"
          render={
            <Button variant="ghost" size="icon" className={ICON_BUTTON_CLS} />
          }
        >
          <X aria-hidden="true" className="size-3.5" />
        </DialogClose>
      </div>
    </div>
  );
};

export const FilePreviewDialog = ({
  editor,
  lines,
  onClose,
  path,
  trigger,
  state,
}: {
  editor?: string;
  lines?: string;
  onClose: () => void;
  path: string;
  trigger: RefObject<HTMLElement | null>;
  state: PreviewState;
}) => (
  <Dialog
    open={state.status !== "closed"}
    onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}
  >
    <DialogContent
      className={`not-prose z-[101] flex h-[min(90dvh,56rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-lg border ${BORDER_CLS} data-open:zoom-in-100 data-closed:zoom-out-100 bg-white p-0 shadow-none ring-0 motion-reduce:animate-none sm:h-[min(85dvh,56rem)] sm:w-[calc(100%-3rem)] sm:max-w-5xl dark:bg-neutral-950`}
      finalFocus={trigger}
      overlayClassName="z-[100] bg-black/15 supports-backdrop-filter:backdrop-blur-none motion-reduce:animate-none"
      showCloseButton={false}
    >
      <Tabs defaultValue="rendered" className="min-h-0 flex-1 gap-0">
        <FilePreviewHeader
          data={state.status === "ready" ? state.data : undefined}
          editor={editor}
          lines={lines}
          path={path}
        />
        <div className="min-h-0 flex-1">
          <FilePreviewContent state={state} path={path} lines={lines} />
        </div>
      </Tabs>
    </DialogContent>
  </Dialog>
);
