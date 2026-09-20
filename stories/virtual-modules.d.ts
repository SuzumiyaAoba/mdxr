declare module "virtual:mdxr-documents" {
  /** relative path (under examples/) → fully rendered standalone HTML */
  const documents: Record<string, string>;
  export default documents;
}

declare module "virtual:mdxr-ascii" {
  /** relative path (under examples/) → plain-markdown ASCII render */
  const documents: Record<string, string>;
  export default documents;
}
