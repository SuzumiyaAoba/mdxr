import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";

export const Figure = defineComponent(
  {
    description:
      "キャプション付き画像。src は必須。caption 属性または children がキャプションになる",
    schema: v.looseObject({
      alt: v.optional(v.string()),
      caption: v.optional(v.string()),
      src: v.string(),
    }),
  },
  ({ src, alt, caption, children }) => {
    const cap = nonEmpty(caption) ? caption : children;
    return (
      <figure className="not-prose my-4">
        <img
          src={src}
          alt={alt ?? ""}
          loading="lazy"
          className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800"
        />
        {cap === undefined ? null : (
          <figcaption className="mt-2 text-center text-sm text-neutral-500 dark:text-neutral-400 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {cap}
          </figcaption>
        )}
      </figure>
    );
  }
);
