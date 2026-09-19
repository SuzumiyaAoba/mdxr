import type { ReactElement } from "react";

import { nonEmpty } from "../guards.js";
import { CaptionBar, CopyButton, MaybeLink, Panel } from "./bits.js";
import type { DiffRow, FileDiff } from "./diff-parse.js";
import { parseDiff } from "./diff-parse.js";
import { fileIcon } from "./file-icon.js";
import { useFileLink } from "./file-link.js";
import { Icon } from "./icon.js";
import {
  CAPTION_TITLE_CLS,
  LINK_CLS,
  MINI_CHIP_CLS,
  RAIL_BG_CLS,
  TEXT,
  TEXT_SUB,
  TONE,
  TONE_BAND,
  TONE_TEXT,
} from "./tones.js";

export { parseDiff } from "./diff-parse.js";
export type { FileDiff } from "./diff-parse.js";

/**
 * Unified-diff rendering. ```diff / ```patch fences route here via `Pre`,
 * so agents emit ordinary patches and get a structured view: per-file
 * headers with editor links, +/- counts and hunks with dual line numbers.
 * Bare `+`/`-` line streams render as a single anonymous file. Parsing
 * lives in `diff-parse.ts`.
 */

/** One block of the 5-block change meter. */
const blockCls = (i: number, green: number, hasChanges: boolean): string => {
  if (i < green) {
    return "bg-emerald-500";
  }
  return hasChanges ? "bg-red-400" : RAIL_BG_CLS;
};

/** GitHub-style 5-block change meter: green share ∝ adds/(adds+dels). */
const StatBlocks = ({
  adds,
  dels,
}: {
  adds: number;
  dels: number;
}): ReactElement => {
  const total = adds + dels;
  const green = total === 0 ? 0 : Math.min(5, Math.round((adds / total) * 5));
  return (
    <span aria-hidden className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          className={`h-2 w-2 rounded-[2px] ${blockCls(i, green, total > 0)}`}
          key={i}
        />
      ))}
    </span>
  );
};

const KINDS: Record<string, { cls: string; label: string }> = {
  deleted: {
    cls: TONE.red,
    label: "deleted",
  },
  new: {
    cls: TONE.emerald,
    label: "new file",
  },
  renamed: {
    cls: TONE.violet,
    label: "renamed",
  },
};

const fileKind = (f: FileDiff): string | undefined => {
  if (f.oldPath === undefined && f.newPath !== undefined) {
    return "new";
  }
  if (f.newPath === undefined && f.oldPath !== undefined) {
    return "deleted";
  }
  if (f.oldPath !== undefined && f.oldPath !== f.newPath) {
    return "renamed";
  }
  return undefined;
};

const ROW_CLS: Record<DiffRow["kind"], string> = {
  add: "bg-emerald-500/10 dark:bg-emerald-500/15",
  ctx: "",
  del: "bg-red-500/10 dark:bg-red-500/15",
  note: `${TEXT.faint} italic`,
};

const SIGN_CLS: Record<DiffRow["kind"], string> = {
  add: TONE_TEXT.emerald,
  ctx: TEXT.ghost,
  del: TONE_TEXT.red,
  note: TEXT.ghost,
};

const SIGNS: Record<DiffRow["kind"], string> = {
  add: "+",
  ctx: " ",
  del: "−",
  note: " ",
};

/** One line-number gutter cell — empty when the row has no line on this side. */
const LineNum = ({ n }: { n?: number }): ReactElement => (
  <span className={`px-2 text-right select-none ${TEXT.faint}`}>{n ?? ""}</span>
);

const DiffRows = ({ rows }: { rows: DiffRow[] }): ReactElement => (
  <div className="font-mono text-[0.8125rem] leading-5">
    {rows.map((row, i) => (
      <div
        className={`grid grid-cols-[2.5rem_2.5rem_1.25rem_minmax(0,1fr)] ${ROW_CLS[row.kind]}`}
        key={i}
      >
        <LineNum n={row.oldLine} />
        <LineNum n={row.newLine} />
        <span className={`text-center select-none ${SIGN_CLS[row.kind]}`}>
          {SIGNS[row.kind]}
        </span>
        <span className={`pr-4 wrap-anywhere whitespace-pre-wrap ${TEXT.code}`}>
          {nonEmpty(row.text) ? row.text : " "}
        </span>
      </div>
    ))}
  </div>
);

const FileCard = ({
  fallbackPath,
  file,
}: {
  fallbackPath?: string;
  file: FileDiff;
}): ReactElement => {
  const path = file.newPath ?? file.oldPath ?? fallbackPath;
  const link = useFileLink(path);
  const kind = fileKind(file);
  const label =
    file.oldPath !== undefined &&
    file.newPath !== undefined &&
    file.oldPath !== file.newPath
      ? `${file.oldPath} → ${file.newPath}`
      : (path ?? "diff");
  return (
    <Panel>
      <CaptionBar className={CAPTION_TITLE_CLS}>
        <Icon
          className="h-3.5 w-3.5 shrink-0"
          name={fileIcon(path ?? "x.diff")}
        />
        <MaybeLink
          className={`min-w-0 truncate font-mono ${LINK_CLS}`}
          href={link}
        >
          {label}
        </MaybeLink>
        {kind === undefined ? null : (
          <span className={`${MINI_CHIP_CLS} ${KINDS[kind].cls}`}>
            {KINDS[kind].label}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span className="font-mono font-medium">
            <span className={TONE_TEXT.emerald}>+{file.adds}</span>{" "}
            <span className={TONE_TEXT.red}>−{file.dels}</span>
          </span>
          <StatBlocks adds={file.adds} dels={file.dels} />
          <CopyButton copy={file.raw.join("\n")} title="Copy diff" />
        </span>
      </CaptionBar>
      {file.meta.length > 0 ? (
        <div
          className={`border-b border-neutral-100 px-4 py-1.5 font-mono ${TEXT_SUB} dark:border-neutral-800/60 ${TEXT.faint}`}
        >
          {file.meta.map((m, i) => (
            <div className="truncate" key={i}>
              {m}
            </div>
          ))}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        {file.hunks.map((h, i) => (
          <div key={i}>
            {nonEmpty(h.header) ? (
              <div
                className={`px-4 py-1 font-mono ${TEXT_SUB} ${TONE_BAND.sky}`}
              >
                {h.header}
              </div>
            ) : null}
            <DiffRows rows={h.rows} />
          </div>
        ))}
      </div>
    </Panel>
  );
};

/** Rendered by `Pre` for ```diff / ```patch fences. */
export const DiffView = ({
  filename,
  text,
}: {
  filename?: string;
  text: string;
}): ReactElement | null => {
  const files = parseDiff(text).filter((f) => f.raw.length > 0);
  if (files.length === 0) {
    return null;
  }
  return (
    <>
      {files.map((f, i) => (
        <FileCard
          fallbackPath={files.length === 1 ? filename : undefined}
          file={f}
          key={i}
        />
      ))}
    </>
  );
};
