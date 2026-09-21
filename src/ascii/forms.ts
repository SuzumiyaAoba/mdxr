/** ASCII renderers for the <Ask> form components — interactive widgets
 *  degrade to a readable questionnaire in plain markdown. */

import type { PhrasingContent, RootContent } from "mdast";

import { nonEmpty, own } from "../guards.js";
import {
  attr,
  els,
  em,
  flag,
  icode,
  item,
  list,
  para,
  strong,
  txt,
} from "./ast.js";
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

const choiceLabel = (node: MdxTarget, ctx: AsciiCtx): PhrasingContent[] => {
  const label = ctx.inline(node);
  return label.length === 0 ? [txt(attr(node, "value") ?? "")] : label;
};

/** Preserve default selections in checkbox lists and radio chips. */
const choice = (
  node: MdxTarget,
  multi: boolean,
  ctx: AsciiCtx
): ReturnType<typeof item> =>
  item(
    [
      para([
        ...(multi
          ? []
          : [icode(flag(node, "checked") ? "(x)" : "( )"), txt(" ")]),
        ...choiceLabel(node, ctx),
        ...(nonEmpty(attr(node, "description"))
          ? [txt(" — "), em([txt(attr(node, "description") ?? "")])]
          : []),
      ]),
    ],
    multi ? flag(node, "checked") : undefined
  );

const question = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const choices = els(node, "Choice");
  const type = (
    attr(node, "type") ?? (choices.length > 0 ? "choice" : "text")
  ).toLowerCase();
  const label = attr(node, "label") ?? attr(node, "name") ?? "";
  const multi = type === "multi";
  const head: RootContent[] = [
    para([
      strong([txt(label)]),
      ...(nonEmpty(attr(node, "name")) && attr(node, "name") !== label
        ? [txt(" "), icode(attr(node, "name") ?? "")]
        : []),
      ...suffix([
        own(TYPE_LABEL, type) ?? type,
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
    head.push(list(choices.map((c) => choice(c, multi, ctx))));
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
    flow: (n, ctx) => [
      para([
        txt("- "),
        ...choiceLabel(n, ctx),
        ...(nonEmpty(attr(n, "description"))
          ? [txt(" — "), em([txt(attr(n, "description") ?? "")])]
          : []),
      ]),
    ],
    text: choiceLabel,
  },
  Question: { flow: question },
};
