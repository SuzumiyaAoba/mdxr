import { defineConfig } from "blume";

export default defineConfig({
  ai: {
    llmsTxt: true,
  },
  // GitHub Pages project site; the account's user Pages uses the custom
  // domain suzumiyaaoba.com, so this site is served at
  // https://suzumiyaaoba.com/mdxr (suzumiyaaoba.github.io/mdxr redirects).
  deployment: {
    base: "/mdxr",
    site: "https://suzumiyaaoba.com",
  },
  description:
    "Render agent-authored MDX documents to standalone HTML with a semantic component catalog.",
  github: {
    branch: "master",
    dir: "docs",
    owner: "SuzumiyaAoba",
    repo: "mdxr",
  },
  i18n: {
    defaultLocale: "en",
    locales: [
      { code: "en", label: "English" },
      { code: "ja", label: "日本語" },
    ],
  },
  lastModified: true,
  title: "mdxr",
});
