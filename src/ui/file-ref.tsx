import * as v from "valibot";

import { defineComponent } from "../define.js";
import { FILE_LINK_PROPS } from "./attrs.js";
import { CodeChip, CopyButton, MaybeLink, PathLabel } from "./bits.js";
import { fileIcon } from "./file-icon.js";
import { useFileLink } from "./file-link.js";
import { Icon } from "./icon.js";
import { LINK_CLS } from "./tones.js";

export const FileRef = defineComponent(
  {
    description:
      'ソースファイルへの参照チップ。lines="10-20" で行範囲を示せる。実在ファイルはエディタリンク（既定 vscode://）になり、href で上書き可。アイコンは拡張子から自動選択',
    schema: v.looseObject({
      ...FILE_LINK_PROPS,
      path: v.string(),
    }),
  },
  ({ path, lines, href }) => {
    const link = useFileLink(path, lines, href);
    const label = (
      <PathLabel lines={lines} linesClassName="opacity-60" path={path} />
    );
    return (
      <CodeChip>
        <Icon className="h-3.5 w-3.5 opacity-60" name={fileIcon(path)} />
        <MaybeLink className={LINK_CLS} href={link}>
          {label}
        </MaybeLink>
        <CopyButton
          className="-mr-0.5 opacity-40"
          copy={path}
          title="Copy path"
        />
      </CodeChip>
    );
  }
);
