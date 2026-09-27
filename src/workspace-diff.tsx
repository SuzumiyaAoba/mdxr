import { useMemo } from "react";

import { WorkspaceCode } from "./workspace-code.js";
import {
  createSplitDiffRows,
  createUnifiedDiffRows,
} from "./workspace-diff-model.js";
import type { DiffLine, SplitDiffCell } from "./workspace-diff-model.js";
import type { SyntaxLines } from "./workspace-syntax.js";

export interface WorkspaceDiffProps {
  lines: DiffLine[];
  layout: "unified" | "split";
  wordDiff: boolean;
  syntax?: { before: SyntaxLines; after: SyntaxLines };
}

const markerFor = (kind: "context" | "add" | "remove"): string => {
  if (kind === "remove") {
    return "−";
  }
  if (kind === "add") {
    return "+";
  }
  return "";
};

const lineNumber = (number: number | null, side: "old" | "new") => (
  <td
    aria-label={number === null ? undefined : `${side} line ${number}`}
    aria-hidden={number === null ? true : undefined}
    className="mdxr-workspace-diff-number"
    data-side={side}
  >
    {number ?? ""}
  </td>
);

const SplitCell = ({
  line,
  side,
  syntax,
}: {
  line: SplitDiffCell | null;
  side: "old" | "new";
  syntax?: SyntaxLines;
}) => {
  if (line === null) {
    return (
      <td
        aria-hidden="true"
        className="mdxr-workspace-diff-cell"
        data-empty="true"
        data-side={side}
      />
    );
  }

  const marker = markerFor(line.kind);
  const syntaxLine = syntax?.[line.lineNumber - 1];
  return (
    <td
      className="mdxr-workspace-diff-cell"
      data-kind={line.kind}
      data-side={side}
    >
      <span className="mdxr-workspace-diff-cell__number">
        {line.lineNumber}
      </span>
      <span aria-hidden="true" className="mdxr-workspace-diff-cell__marker">
        {marker}
      </span>
      <span className="mdxr-workspace-diff-cell__text">
        <WorkspaceCode
          text={line.text}
          syntax={syntaxLine}
          words={line.tokens}
        />
      </span>
    </td>
  );
};

const SplitDiff = ({ lines, wordDiff, syntax }: WorkspaceDiffProps) => {
  const rows = useMemo(
    () => createSplitDiffRows(lines, wordDiff),
    [lines, wordDiff]
  );
  return (
    <table
      aria-label="Side-by-side diff"
      className="mdxr-workspace-diff-view"
      data-layout="split"
      data-word-diff={wordDiff}
    >
      <thead className="mdxr-workspace-diff-header">
        <tr>
          <th
            className="mdxr-workspace-diff-header__cell"
            data-side="old"
            scope="col"
          >
            Before
          </th>
          <th
            className="mdxr-workspace-diff-header__cell"
            data-side="new"
            scope="col"
          >
            After
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr className="mdxr-workspace-diff-row" key={row.key}>
            <SplitCell line={row.oldLine} side="old" syntax={syntax?.before} />
            <SplitCell line={row.newLine} side="new" syntax={syntax?.after} />
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const UnifiedDiff = ({ lines, wordDiff, syntax }: WorkspaceDiffProps) => {
  const rows = useMemo(
    () => createUnifiedDiffRows(lines, wordDiff),
    [lines, wordDiff]
  );
  return (
    <table
      aria-label="Unified diff"
      className="mdxr-workspace-diff-view"
      data-layout="unified"
      data-word-diff={wordDiff}
    >
      <tbody>
        {rows.map((row) => {
          const marker = markerFor(row.type);
          const syntaxLineNumber =
            row.type === "remove" ? row.oldNumber : row.newNumber;
          const syntaxSource =
            row.type === "remove" ? syntax?.before : syntax?.after;
          const syntaxLine =
            syntaxLineNumber === null || syntaxLineNumber === undefined
              ? undefined
              : syntaxSource?.[syntaxLineNumber - 1];
          return (
            <tr
              className="mdxr-workspace-diff-row"
              data-kind={row.type}
              key={row.key}
            >
              {lineNumber(row.oldNumber, "old")}
              {lineNumber(row.newNumber, "new")}
              <td
                aria-hidden="true"
                className="mdxr-workspace-diff-marker"
                data-kind={row.type}
              >
                {marker}
              </td>
              <td className="mdxr-workspace-diff-text" data-kind={row.type}>
                <WorkspaceCode
                  text={row.text}
                  syntax={syntaxLine}
                  words={row.tokens}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export const WorkspaceDiff = (props: WorkspaceDiffProps) => {
  if (props.layout === "split") {
    return <SplitDiff {...props} />;
  }
  return <UnifiedDiff {...props} />;
};
