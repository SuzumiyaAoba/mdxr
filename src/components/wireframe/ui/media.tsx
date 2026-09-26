// Adapted from wireframe-ui (MIT). See src/wireframe-ui.LICENSE.md.
import {
  MusicalNoteIcon,
  PhotoIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { cn } from "cn";
import { useState } from "react";
import type { ComponentProps } from "react";
export interface MediaProps extends Omit<
  ComponentProps<"div">,
  "onLoad" | "onError"
> {
  src?: string;
  alt?: string;
  label?: string;
  type?: "image" | "video" | "audio";
  aspectRatio?: "square" | "video" | "portrait" | "auto";
  loading?: boolean;
  captions?: string;
  onLoad?: () => void;
  onError?: () => void;
}
const ASPECTS = {
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-[3/4]",
  auto: "min-h-24",
};
const ICONS = { image: PhotoIcon, video: PlayIcon, audio: MusicalNoteIcon };
function LoadedMedia({
  src,
  alt,
  type,
  captions,
  onLoad,
  onError,
}: Pick<
  MediaProps,
  "src" | "alt" | "type" | "captions" | "onLoad" | "onError"
>) {
  if (type === "video")
    return (
      <video
        aria-label={alt}
        className="size-full object-cover"
        controls
        onError={onError}
        onLoadedData={onLoad}
        src={src}
      >
        <track kind="captions" src={captions} />
      </video>
    );
  if (type === "audio")
    return (
      <div className="flex min-h-24 items-center p-4">
        <audio
          aria-label={alt}
          className="w-full"
          controls
          onError={onError}
          onLoadedData={onLoad}
          src={src}
        />
      </div>
    );
  return (
    <img
      alt={alt ?? "Media"}
      className="size-full object-cover"
      onError={onError}
      onLoad={onLoad}
      src={src}
    />
  );
}
function MediaContent({
  src,
  alt,
  label,
  type = "image",
  aspectRatio = "video",
  loading = false,
  captions,
  onLoad,
  onError,
  className,
  ...props
}: MediaProps) {
  const [failed, setFailed] = useState(false);
  const placeholder = loading || !src || failed;
  const Icon = ICONS[type];
  const description = label ?? alt ?? `${type} placeholder`;
  const handleError = () => {
    setFailed(true);
    onError?.();
  };
  return (
    <div
      aria-label={placeholder ? description : undefined}
      className={cn(
        "border-input bg-card relative min-w-0 overflow-hidden rounded-lg border",
        ASPECTS[aspectRatio],
        className
      )}
      data-slot="wireframe-media"
      data-type={type}
      role={placeholder ? "img" : undefined}
      {...props}
    >
      {src && !failed && (
        <LoadedMedia
          src={src}
          alt={alt ?? description}
          type={type}
          captions={captions}
          onLoad={onLoad}
          onError={handleError}
        />
      )}
      {placeholder && (
        <div className="bg-card text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
          <Icon aria-hidden="true" className="size-12 shrink-0 opacity-40" />
          {label && (
            <span aria-hidden="true" className="text-xs">
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
function Media(props: MediaProps) {
  return (
    <MediaContent
      key={`${props.type ?? "image"}:${props.src ?? ""}`}
      {...props}
    />
  );
}
export { Media };
