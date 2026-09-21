import * as v from "valibot";

import { defineComponent } from "../define.js";
import { display } from "../extended/data.js";

export const RecordItem = defineComponent(
  {
    description: "Structured report row; attributes become data fields.",
    schema: v.looseObject({ name: v.optional(v.string()) }),
  },
  (props) => (
    <dl className="p-3">
      {Object.entries(props)
        .filter(([key]) => key !== "children")
        .map(([key, value]) => (
          <div key={key}>
            <dt className="inline font-medium">{key}: </dt>
            <dd className="inline">{display(value)}</dd>
          </div>
        ))}
      {props.children}
    </dl>
  )
);
