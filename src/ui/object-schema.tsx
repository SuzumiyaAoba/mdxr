import * as v from "valibot";

import { defineComponent } from "../define.js";
import {
  display,
  parseJson,
  keyed,
  isDataRecord as isRecord,
} from "../extended/data.js";
import { schemaRows } from "../extended/differences.js";
import { dataChildren } from "./data-children.js";
import { DataPanel } from "./data-view.js";

const SchemaBranch = ({
  name,
  schema,
  required = false,
  depth = 0,
}: {
  name: string;
  schema: unknown;
  required?: boolean;
  depth?: number;
}) => {
  if (!isRecord(schema) || depth > 40) {
    throw new Error("ObjectSchema: invalid or excessively deep schema");
  }
  const properties = isRecord(schema.properties)
    ? Object.entries(schema.properties)
    : [];
  const requiredKeys = new Set(
    Array.isArray(schema.required) ? schema.required : []
  );
  return (
    <details
      className="my-1 border-l border-neutral-200 pl-4 dark:border-neutral-700"
      open={depth < 2}
    >
      <summary className="cursor-pointer py-1 font-mono text-sm">
        <strong>{name}</strong> ·{" "}
        {display(schema.type) || (properties.length ? "object" : "schema")}
        {required ? " · required" : ""}
        {schema.$ref !== undefined && schema.$ref !== null
          ? ` · ${display(schema.$ref)}`
          : ""}
      </summary>
      <div className="py-2 text-sm">
        {display(schema.description)}
        {["default", "enum", "minimum", "maximum", "pattern", "format"]
          .filter((key) => schema[key] !== undefined)
          .map((key) => (
            <p key={key}>
              {key}: <code>{display(schema[key])}</code>
            </p>
          ))}
      </div>
      {properties.map(([key, value]) => (
        <SchemaBranch
          key={key}
          name={key}
          schema={value}
          required={requiredKeys.has(key)}
          depth={depth + 1}
        />
      ))}
      {schema.items !== undefined && schema.items !== null ? (
        <SchemaBranch name="items[]" schema={schema.items} depth={depth + 1} />
      ) : null}
      {["oneOf", "anyOf", "allOf"].map((key) =>
        Array.isArray(schema[key])
          ? keyed<unknown>(schema[key]).map(
              ({ key: branchKey, value }, index) => (
                <SchemaBranch
                  key={`${key}-${branchKey}`}
                  name={`${key} ${index + 1}`}
                  schema={value}
                  depth={depth + 1}
                />
              )
            )
          : null
      )}
    </details>
  );
};

export const ObjectSchema = defineComponent(
  {
    description:
      "Expandable JSON Schema tree with properties, arrays, unions, required fields, constraints and examples.",
    schema: v.looseObject({
      id: v.optional(v.string()),
      schema: v.optional(v.string()),
      title: v.optional(v.string()),
    }),
  },
  (props) => {
    const source = props.schema ?? dataChildren(props.children)?.source ?? "{}";
    const schema: unknown = parseJson(source, "schema");
    schemaRows(schema);
    return (
      <DataPanel title={props.title ?? "Object schema"} id={props.id}>
        <div className="p-4">
          <SchemaBranch name="root" schema={schema} />
        </div>
      </DataPanel>
    );
  }
);
