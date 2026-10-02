declare module "virtual:doc-documents" {
  /** relative path (under examples/) → fully rendered standalone HTML */
  const documents: Record<string, string>;
  export default documents;
}

declare module "virtual:doc-ascii" {
  /** relative path (under examples/) → plain-markdown ASCII render */
  const documents: Record<string, string>;
  export default documents;
}

declare module "virtual:doc-component/*" {
  /** Standalone HTML for one component's compile-time integration fixture. */
  const html: string;
  export default html;
}
