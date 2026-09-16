import type { Preview } from "@storybook/react-vite";
import { useEffect } from "react";

import { BASE_CSS, handleCopyClick } from "../src/assets.js";
import { enhanceRenderedBlocks } from "./enhance.js";

import "./preview.css";

// Rules Tailwind utilities can't express (task lists, copy-button state).
// Rendered documents inline BASE_CSS; component stories inject it once.
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = BASE_CSS;
  document.head.append(style);
  // Rendered documents inline this listener via CLIENT_JS.
  document.addEventListener("click", handleCopyClick);
}

const ThemeSync = ({ dark }: { dark: boolean }): null => {
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return null;
};

/**
 * Component stories bypass the render pipeline, so the post-passes documents
 * get — shiki highlighting and mermaid.run — are replayed on the DOM here.
 * Runs after every commit; both passes skip nodes they already handled.
 */
const DocumentEnhancements = (): null => {
  useEffect(() => {
    void enhanceRenderedBlocks(document);
  });
  return null;
};

const preview: Preview = {
  decorators: [
    (Story, context) => (
      <>
        <ThemeSync dark={context.globals.theme === "dark"} />
        <DocumentEnhancements />
        {context.parameters.rvDocument === true ? (
          <Story />
        ) : (
          // Same chrome as the standalone document: <body> colors on the
          // outer box, `prose` + max-w-3xl column inside.
          <div className="prose prose-neutral dark:prose-invert min-h-screen bg-white px-6 py-10 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
            <div className="mx-auto max-w-3xl">
              <Story />
            </div>
          </div>
        )}
      </>
    ),
  ],
  globalTypes: {
    theme: {
      description: "Color scheme for component stories",
      toolbar: {
        dynamicTitle: true,
        icon: "moon",
        items: [
          { title: "Light", value: "light" },
          { title: "Dark", value: "dark" },
        ],
      },
    },
  },
  initialGlobals: { theme: "light" },
};

export default preview;
