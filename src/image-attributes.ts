/** Image URL props that need the same path handling as Markdown images. */
export const JSX_IMAGE_ATTRIBUTES: Readonly<Record<string, readonly string[]>> =
  {
    Figure: ["src"],
    ImageCompare: ["before", "after"],
    img: ["src"],
    video: ["poster"],
  };
