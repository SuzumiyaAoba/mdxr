/** ASCII renderers for the <Ask> form components — interactive widgets
 *  degrade to a readable questionnaire in plain markdown. */

import type { RootContent } from "mdast";

import { nonEmpty } from "../guards.js";
import { attr, els, em, icode, item, list, para, strong, txt } from "./ast.js";
import type { AsciiCtx, AsciiRegistry, MdxTarget } from "./ast.js";
import { caption, suffix } from "./parts.js";

/** Question type → markdown affordance hint. */
const TYPE_LABEL: Record<string, string> = {
  choice: "pick one",
  multi: "pick any",
  select: "pick one",
  text: "short answer",
  textarea: "long answer",
  toggle: "yes/no",
};

/** `multi` → a real `- [ ]` checkbox; anything else → a `` `( )` `` radio chip. */
const choice = (node: MdxTarget, multi: boolean): ReturnType<typeof item> =>
  item(
    [
      para([
        ...(multi ? [] : [icode("( )"), txt(" ")]),
        txt(attr(node, "value") ?? ""),
        ...(nonEmpty(attr(node, "description"))
          ? [txt(" — "), em([txt(attr(node, "description") ?? "")])]
          : []),
      ]),
    ],
    multi ? false : undefined
  );

const question = (node: MdxTarget, _ctx: AsciiCtx): RootContent[] => {
  const type = (attr(node, "type") ?? "text").toLowerCase();
  const label = attr(node, "label") ?? attr(node, "name") ?? "";
  const choices = els(node, "Choice");
  const multi = type === "multi";
  const head: RootContent[] = [
    para([
      strong([txt(label)]),
      ...(nonEmpty(attr(node, "name")) && attr(node, "name") !== label
        ? [txt(" "), icode(attr(node, "name") ?? "")]
        : []),
      ...suffix([
        TYPE_LABEL[type] ?? type,
        nonEmpty(attr(node, "placeholder"))
          ? `e.g. ${attr(node, "placeholder")}`
          : undefined,
      ]),
    ]),
    ...(nonEmpty(attr(node, "description"))
      ? [para([em([txt(attr(node, "description") ?? "")])])]
      : []),
  ];
  if (choices.length > 0) {
    head.push(list(choices.map((c) => choice(c, multi))));
  } else if (type === "text" || type === "textarea") {
    head.push(para([icode("[____________________]")]));
  }
  if (nonEmpty(attr(node, "value"))) {
    head.push(para([em([txt(`default: ${attr(node, "value")}`)])]));
  }
  return head;
};

export const formRenderers: AsciiRegistry = {
  Ask: {
    flow: (n, ctx) => [
      ...caption(attr(n, "title")),
      ...(nonEmpty(attr(n, "description"))
        ? [para([em([txt(attr(n, "description") ?? "")])])]
        : []),
      ...ctx.children(n),
    ],
  },
  Choice: {
    flow: (n) => [
      para([
        txt("- "),
        txt(attr(n, "value") ?? ""),
        ...(nonEmpty(attr(n, "description"))
          ? [txt(" — "), em([txt(attr(n, "description") ?? "")])]
          : []),
      ]),
    ],
    text: (n) => [icode(attr(n, "value") ?? "")],
  },
  Question: { flow: question },
};
