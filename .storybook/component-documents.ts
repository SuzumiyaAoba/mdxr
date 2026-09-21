import path from "node:path";

import type { Plugin } from "vite";

type RenderFile = (file: string) => Promise<string>;

const PREFIX = "virtual:mdxr-component/";
const RESOLVED_PREFIX = `\0${PREFIX}`;
const DOCUMENTS = new Map([
  ["Sources", "sources"],
  ["Source", "sources"],
  ["Cite", "sources"],
  ["CrossRef", "cross-ref"],
  ["TermRef", "term-ref"],
  ["Include", "include"],
  ["TableOfFigures", "table-of-figures"],
  ["NumberedEquation", "numbered-equation"],
  ["Theorem", "theorem"],
]);

/** Compile only the document needed by a component's reference/inclusion story. */
export const mdxrComponentDocuments = (
  root: string,
  loadRenderer: () => Promise<RenderFile>
): Plugin => {
  const fixtures = path.join(root, ".storybook", "fixtures");
  const source = path.join(root, "src");
  const included = path.join(root, "tests", "fixtures", "extended-include.mdx");
  const cache = new Map<string, Promise<string>>();
  let renderer: Promise<RenderFile> | undefined;

  const render = async (file: string): Promise<string> => {
    renderer ??= loadRenderer();
    const renderFile = await renderer;
    return await renderFile(file);
  };

  return {
    configureServer(server) {
      server.watcher.add([fixtures, source, included]);
    },
    handleHotUpdate(context) {
      const { file, server } = context;
      if (
        !file.startsWith(`${fixtures}${path.sep}`) &&
        !file.startsWith(`${source}${path.sep}`) &&
        file !== included
      ) {
        return context.modules;
      }
      cache.clear();
      renderer = undefined;
      const modules = [...DOCUMENTS.keys()].flatMap((name) => {
        const module = server.moduleGraph.getModuleById(
          `${RESOLVED_PREFIX}${name}`
        );
        if (module === undefined) {
          return [];
        }
        server.moduleGraph.invalidateModule(module);
        return [module];
      });
      return [...context.modules, ...modules];
    },
    async load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) {
        return null;
      }
      const name = id.slice(RESOLVED_PREFIX.length);
      const document = DOCUMENTS.get(name);
      if (document === undefined) {
        throw new Error(`Unknown component document: ${name}`);
      }
      const file = path.join(fixtures, `${document}.mdx`);
      this.addWatchFile(file);
      this.addWatchFile(included);
      let html = cache.get(file);
      if (html === undefined) {
        html = render(file);
        cache.set(file, html);
      }
      return `export default ${JSON.stringify(await html)};`;
    },
    name: "mdxr-component-documents",
    resolveId(id) {
      if (id.startsWith(PREFIX)) {
        return `\0${id}`;
      }
      return null;
    },
  };
};
