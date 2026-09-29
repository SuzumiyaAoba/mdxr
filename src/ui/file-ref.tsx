import { useContext, useRef } from "react";
import type { MouseEvent } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { DocContext } from "../doc-context.js";
import { safeHref } from "../guards.js";
import { FILE_LINK_PROPS } from "./attrs.js";
import { CodeChip, CopyButton, MaybeLink, PathLabel } from "./bits.js";
import { fileIcon } from "./file-icon.js";
import { useFileLink } from "./file-link.js";
import { FilePreviewDialog, useFilePreview } from "./file-preview.js";
import { Icon } from "./icon.js";
import { LINK_CLS } from "./tones.js";

export const FileRef = defineComponent(
  {
    description:
      'ソースファイルへの参照チップ。lines="10-20" で行範囲を示せる。serve では実在ファイルをモーダルでプレビューし、HTML を直接開く場合はエディタリンク（既定 vscode://）。href で上書き可。アイコンは拡張子から自動選択',
    schema: v.looseObject({
      ...FILE_LINK_PROPS,
      path: v.string(),
    }),
  },
  ({ path, lines, href }) => {
    const link = useFileLink(path, lines, href);
    const { filePreview } = useContext(DocContext);
    const preview =
      safeHref(href) === undefined ? filePreview?.(path) : undefined;
    const { state, openPreview: loadPreview, closePreview } = useFilePreview();
    const trigger = useRef<HTMLElement>(null);
    const openPreview = (event: MouseEvent<HTMLElement>): void => {
      if (
        preview === undefined ||
        !["http:", "https:"].includes(window.location.protocol) ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      trigger.current = event.currentTarget;
      void loadPreview(preview);
    };
    const label = (
      <PathLabel lines={lines} linesClassName="opacity-60" path={path} />
    );
    const labelClass = `min-w-0 overflow-x-auto whitespace-nowrap ${LINK_CLS}`;
    let labelLink = (
      <MaybeLink className={labelClass} href={link}>
        {label}
      </MaybeLink>
    );
    if (preview !== undefined) {
      labelLink =
        link === undefined ? (
          <button
            type="button"
            aria-haspopup="dialog"
            className={`cursor-pointer ${labelClass}`}
            data-mdxr-file-preview={preview}
            onClick={openPreview}
          >
            {label}
          </button>
        ) : (
          <a
            aria-haspopup="dialog"
            className={labelClass}
            data-mdxr-file-preview={preview}
            href={link}
            onClick={openPreview}
          >
            {label}
          </a>
        );
    }
    return (
      <>
        <CodeChip>
          <Icon className="h-3.5 w-3.5 opacity-60" name={fileIcon(path)} />
          {labelLink}
          <CopyButton
            className="-mr-0.5 opacity-40"
            copy={path}
            title="Copy path"
          />
        </CodeChip>
        {preview === undefined ? null : (
          <FilePreviewDialog
            editor={link}
            lines={lines}
            onClose={closePreview}
            path={path}
            trigger={trigger}
            state={state}
          />
        )}
      </>
    );
  }
);
