import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { BORDER_CLS, TEXT, TRIM_CLS } from "./tones.js";

export const Figure = defineComponent(
  {
    description:
      "キャプション付き画像。src は必須。caption 属性または children がキャプションになる",
    schema: v.looseObject({
      alt: v.optional(v.string()),
      caption: v.optional(v.string()),
      id: v.optional(v.string()),
      number: v.optional(v.string()),
      src: v.string(),
    }),
  },
  ({ src, alt, caption, children, id, number }) => {
    const cap = nonEmpty(caption) ? caption : children;
    return (
      <figure className="not-prose my-6" id={id}>
        <img
          src={src}
          alt={alt ?? ""}
          loading="lazy"
          className={`w-full rounded-lg border ${BORDER_CLS}`}
        />
        {cap === undefined ? null : (
          <figcaption
            className={`mt-2 text-center text-sm ${TEXT.muted} ${TRIM_CLS}`}
          >
            {number !== undefined && number !== "" ? `Figure ${number}: ` : ""}
            {cap}
          </figcaption>
        )}
      </figure>
    );
  }
);
