import type { ReactElement } from "react";
import * as v from "valibot";

import { nonEmpty } from "../guards.js";
import { Due } from "./due.js";
import { Effort, EFFORT_SIZES } from "./effort.js";
import type { EffortSize } from "./effort.js";
import { Owner } from "./owner.js";
import { Priority, PRIORITY_LEVELS } from "./priority.js";
import type { PriorityLevel } from "./priority.js";

/**
 * Schema entries matching ChipRow's props — spread into the schema of any
 * component that renders a ChipRow so props and rendering stay in sync.
 */
export const CHIP_PROPS = {
  due: v.optional(v.string()),
  effort: v.optional(v.picklist(EFFORT_SIZES)),
  owner: v.optional(v.string()),
  priority: v.optional(v.picklist(PRIORITY_LEVELS)),
} as const;

/**
 * The `priority · effort · owner · due` chip row shared by task-like
 * components (Step, BoardCard). Renders nothing when no chip prop is set —
 * callers must not pre-check, so a lone chip can never leave an empty row.
 */
export const ChipRow = (props: {
  due?: string;
  effort?: EffortSize;
  owner?: string;
  priority?: PriorityLevel;
}): ReactElement | null => {
  const any =
    props.priority !== undefined ||
    props.effort !== undefined ||
    nonEmpty(props.owner) ||
    nonEmpty(props.due);
  return any ? (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {props.priority === undefined ? null : (
        <Priority level={props.priority} />
      )}
      {props.effort === undefined ? null : <Effort size={props.effort} />}
      {nonEmpty(props.owner) ? <Owner name={props.owner} /> : null}
      {nonEmpty(props.due) ? <Due date={props.due} /> : null}
    </div>
  ) : null;
};
