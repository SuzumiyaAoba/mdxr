import { useId, useRef, useState } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import {
  display,
  numberValue,
  positive,
  keyed,
  recordKey,
} from "../extended/data.js";
import { safeHref } from "../guards.js";
import { attrTrue, BOOLISH_PROP } from "./attrs.js";
import { rowsFrom } from "./data-children.js";
import { DATA_BUTTON, DATA_PROPS } from "./data-props.js";
import { DataPanel } from "./data-view.js";

export const ImageGallery = defineComponent(
  {
    description:
      "Captioned image grid and native modal viewer. Rows: src,alt,caption.",
    schema: v.looseObject(DATA_PROPS),
  },
  (props) => {
    const rows = rowsFrom(props);
    const [selected, setSelected] = useState(0);
    const dialog = useRef<HTMLDialogElement>(null);
    const id = useId();
    const row = rows[selected];
    return (
      <DataPanel title={props.title ?? "Gallery"} id={props.id}>
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3">
          {keyed(rows, recordKey).map(({ key, value: item }, index) => (
            <figure key={key}>
              <button
                type="button"
                className="w-full rounded-lg focus-visible:outline-2 focus-visible:outline-sky-500"
                onClick={() => {
                  setSelected(index);
                  dialog.current?.showModal();
                }}
              >
                <img
                  className="aspect-video w-full rounded-lg object-cover"
                  src={safeHref(display(item.src))}
                  alt={
                    display(item.alt ?? item.caption) || `Image ${index + 1}`
                  }
                  loading="lazy"
                />
              </button>
              <figcaption className="mt-1 text-sm">
                {display(item.caption)}
              </figcaption>
            </figure>
          ))}
        </div>
        <dialog
          ref={dialog}
          aria-labelledby={id}
          className="max-h-[90vh] w-[min(90vw,70rem)] rounded-xl bg-white p-4 text-neutral-900 backdrop:bg-black/70 dark:bg-neutral-900 dark:text-neutral-100"
        >
          <div className="mb-3 flex justify-between gap-3">
            <p id={id}>{display(row?.caption) || `Image ${selected + 1}`}</p>
            <button
              className={DATA_BUTTON}
              type="button"
              onClick={() => dialog.current?.close()}
            >
              Close
            </button>
          </div>
          {row === undefined ? null : (
            <img
              className="max-h-[70vh] w-full object-contain"
              src={safeHref(display(row.src))}
              alt={display(row.alt ?? row.caption) || `Image ${selected + 1}`}
            />
          )}
          <div className="mt-3 flex justify-between">
            <button
              className={DATA_BUTTON}
              type="button"
              disabled={selected === 0}
              onClick={() => {
                setSelected(selected - 1);
              }}
            >
              Previous image
            </button>
            <button
              className={DATA_BUTTON}
              type="button"
              disabled={selected + 1 >= rows.length}
              onClick={() => {
                setSelected(selected + 1);
              }}
            >
              Next image
            </button>
          </div>
        </dialog>
      </DataPanel>
    );
  }
);

export const AnnotatedImage = defineComponent(
  {
    description:
      "Image annotations in percentage coordinates; rows: x,y,width,height,label,note. Clicking a marker reveals its explanation.",
    schema: v.looseObject({ ...DATA_PROPS, alt: v.string(), src: v.string() }),
  },
  (props) => {
    const rows = rowsFrom(props);
    const [active, setActive] = useState(0);
    const uid = useId();
    for (const row of rows) {
      for (const key of ["x", "y", "width", "height"]) {
        if (
          row[key] !== undefined &&
          (numberValue(row[key]) < 0 || numberValue(row[key]) > 100)
        ) {
          throw new Error(
            "AnnotatedImage: coordinates must be percentages from 0 to 100"
          );
        }
      }
    }
    return (
      <DataPanel title={props.title ?? "Annotated image"} id={props.id}>
        <div className="relative m-4">
          <img
            src={safeHref(props.src)}
            alt={props.alt}
            className="w-full rounded-lg"
          />
          {keyed(rows, recordKey).map(({ key, value: row }, index) => (
            <button
              key={key}
              className={`absolute min-h-7 min-w-7 rounded border-2 border-sky-600 bg-white/80 text-xs font-bold text-sky-900 focus-visible:outline-2 ${active === index ? "ring-2 ring-amber-500" : ""}`}
              style={{
                height:
                  row.height === undefined
                    ? undefined
                    : `${numberValue(row.height)}%`,
                left: `${numberValue(row.x)}%`,
                top: `${numberValue(row.y)}%`,
                width:
                  row.width === undefined
                    ? undefined
                    : `${numberValue(row.width)}%`,
              }}
              type="button"
              aria-label={display(row.label) || `Annotation ${index + 1}`}
              aria-describedby={`${uid}-annotation`}
              onClick={() => {
                setActive(index);
              }}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <output className="px-4 pb-3" id={`${uid}-annotation`}>
          {display(rows[active]?.label)} {display(rows[active]?.note)}
        </output>
        <details className="p-4">
          <summary>All annotations</summary>
          <ol>
            {keyed(rows, recordKey).map(({ key, value: row }, i) => (
              <li key={key}>
                {i + 1}. {display(row.label)} — {display(row.note)}
              </li>
            ))}
          </ol>
        </details>
      </DataPanel>
    );
  }
);

const compareSchema = v.looseObject({
  after: v.string(),
  afterAlt: v.optional(v.string(), "After"),
  before: v.string(),
  beforeAlt: v.optional(v.string(), "Before"),
  id: v.optional(v.string()),
  title: v.optional(v.string()),
});
export const ImageCompare = defineComponent(
  {
    description:
      "Before/after image comparison controlled by an accessible slider.",
    schema: compareSchema,
  },
  (props) => {
    const [position, setPosition] = useState(50);
    const id = useId();
    return (
      <DataPanel title={props.title ?? "Image comparison"} id={props.id}>
        <div className="relative m-4 overflow-hidden rounded-lg">
          <img
            src={safeHref(props.before)}
            alt={props.beforeAlt}
            className="w-full"
          />
          <img
            src={safeHref(props.after)}
            alt={props.afterAlt}
            className="absolute inset-0 h-full w-full object-contain"
            style={{ clipPath: `inset(0 0 0 ${position}%)` }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-amber-500"
            style={{ left: `${position}%` }}
          />
        </div>
        <div className="px-4 pb-4">
          <label htmlFor={id} className="flex justify-between text-sm">
            <span>{props.beforeAlt}</span>
            <span>{props.afterAlt}</span>
          </label>
          <input
            id={id}
            className="w-full"
            type="range"
            min="0"
            max="100"
            value={position}
            aria-label="Comparison split"
            onChange={(event) => {
              setPosition(Number(event.target.value));
            }}
          />
        </div>
      </DataPanel>
    );
  }
);

export const VisualDiff = defineComponent(
  {
    description:
      "Visual regression evidence: expected, actual and externally generated difference image with mismatch percentage.",
    schema: v.looseObject({
      actual: v.string(),
      diff: v.string(),
      expected: v.string(),
      mismatch: v.optional(v.string()),
      title: v.optional(v.string()),
      viewport: v.optional(v.string()),
    }),
  },
  ({ expected, actual, diff, mismatch, viewport, title }) => (
    <DataPanel
      title={title ?? "Visual regression"}
      summary={[
        mismatch !== undefined && mismatch !== ""
          ? `${mismatch}% mismatch`
          : "",
        viewport,
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      <div className="grid gap-4 p-4 md:grid-cols-3">
        {[
          { label: "Expected", src: expected },
          { label: "Actual", src: actual },
          { label: "Difference", src: diff },
        ].map((item) => (
          <figure key={item.label}>
            <a href={safeHref(item.src)}>
              <img
                src={safeHref(item.src)}
                alt={`${item.label} screenshot`}
                className="w-full rounded border border-neutral-200"
                loading="lazy"
              />
            </a>
            <figcaption className="mt-1 text-center text-sm">
              {item.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </DataPanel>
  )
);

export const Video = defineComponent(
  {
    description:
      "Native video player with required caption track, optional chapter track and poster.",
    schema: v.looseObject({
      captions: v.string(),
      chapters: v.optional(v.string()),
      language: v.optional(v.string(), "en"),
      poster: v.optional(v.string()),
      src: v.string(),
      title: v.optional(v.string()),
    }),
  },
  ({ src, captions, language, chapters, poster, title, children }) => (
    <DataPanel title={title ?? "Video"}>
      <video
        className="w-full"
        controls
        preload="metadata"
        poster={
          poster !== undefined && poster !== "" ? safeHref(poster) : undefined
        }
      >
        <source src={safeHref(src)} />
        <track
          kind="captions"
          src={safeHref(captions)}
          srcLang={language}
          label="Captions"
          default
        />
        {chapters !== undefined && chapters !== "" ? (
          <track
            kind="chapters"
            src={safeHref(chapters)}
            srcLang={language}
            label="Chapters"
          />
        ) : null}
        <a href={safeHref(src)}>Download video</a>
      </video>
      {children !== undefined && children !== null ? (
        <div className="p-4">{children}</div>
      ) : null}
    </DataPanel>
  )
);

export const AudioTranscript = defineComponent(
  {
    description:
      "Native audio player with seekable transcript rows: time (seconds), text. Optional WebVTT captions.",
    schema: v.looseObject({
      ...DATA_PROPS,
      captions: v.optional(v.string()),
      language: v.optional(v.string(), "en"),
      src: v.string(),
    }),
  },
  (props) => {
    const rows = rowsFrom(props).toSorted(
      (a, b) => numberValue(a.time) - numberValue(b.time)
    );
    for (const row of rows) {
      positive(row.time, "time");
    }
    const audio = useRef<HTMLAudioElement>(null);
    const [time, setTime] = useState(0);
    const current = rows.findLastIndex((row) => numberValue(row.time) <= time);
    return (
      <DataPanel title={props.title ?? "Audio transcript"} id={props.id}>
        <audio
          ref={audio}
          className="w-full"
          controls
          preload="metadata"
          onTimeUpdate={(event) => {
            setTime(event.currentTarget.currentTime);
          }}
        >
          <source src={safeHref(props.src)} />
          <track
            kind="captions"
            src={
              props.captions === undefined
                ? undefined
                : safeHref(props.captions)
            }
            srcLang={props.language}
          />
          <a href={safeHref(props.src)}>Download audio</a>
        </audio>
        <ol className="max-h-96 space-y-2 overflow-auto p-4">
          {keyed(rows, recordKey).map(({ key, value: row }, index) => (
            <li key={key}>
              <button
                type="button"
                className={`w-full rounded p-2 text-left text-sm ${current === index ? "bg-sky-100 dark:bg-sky-950" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
                aria-current={current === index ? "true" : undefined}
                onClick={() => {
                  if (audio.current) {
                    audio.current.currentTime = numberValue(row.time);
                  }
                  setTime(numberValue(row.time));
                }}
              >
                <span className="mr-3 font-mono text-xs">
                  {Math.floor(numberValue(row.time) / 60)}:
                  {String(Math.floor(numberValue(row.time) % 60)).padStart(
                    2,
                    "0"
                  )}
                </span>
                {display(row.text)}
              </button>
            </li>
          ))}
        </ol>
      </DataPanel>
    );
  }
);

export const PdfPreview = defineComponent(
  {
    description:
      "Browser PDF preview with page selection and an always available source link.",
    schema: v.looseObject({
      height: v.optional(v.string(), "600"),
      page: v.optional(v.string(), "1"),
      src: v.string(),
      title: v.optional(v.string(), "PDF document"),
    }),
  },
  ({ src, title, page, height }) => {
    const number = numberValue(page, "page");
    const pixels = numberValue(height, "height");
    if (!Number.isInteger(number) || number < 1 || pixels < 100) {
      throw new Error(
        "PdfPreview: page must be a positive integer and height ≥ 100"
      );
    }
    const url = safeHref(src);
    if (!(url !== undefined && url !== "")) {
      throw new Error("PdfPreview: src must be a safe URL");
    }
    return (
      <DataPanel title={title}>
        <object
          title={title}
          aria-label={title}
          data={`${url.split("#")[0]}#page=${number}`}
          type="application/pdf"
          className="w-full border-0"
          height={pixels}
        >
          <p className="p-3">PDF preview is unavailable in this browser.</p>
        </object>
        <p className="p-3">
          <a className="underline" href={url}>
            Open or download {title}
          </a>
        </p>
      </DataPanel>
    );
  }
);

export const PrintLayout = defineComponent(
  {
    description:
      "Print layout with one/two columns and optional keep-together blocks.",
    schema: v.looseObject({
      columns: v.optional(v.picklist(["1", "2"]), "1"),
      keepTogether: BOOLISH_PROP,
      title: v.optional(v.string()),
    }),
  },
  ({ columns, keepTogether, title, children }) => (
    <section
      aria-label={title}
      className={`mdxr-print-layout ${columns === "2" ? "print:columns-2 print:gap-8" : ""} ${attrTrue(keepTogether) ? "print:break-inside-avoid" : ""}`}
    >
      {children}
    </section>
  )
);
export const PageBreak = defineComponent(
  {
    description:
      "Explicit print page break; neutral separator in screen documents.",
  },
  () => (
    <div
      className="my-6 border-t border-dashed border-neutral-300 print:m-0 print:break-before-page print:border-0"
      aria-hidden="true"
    />
  )
);
