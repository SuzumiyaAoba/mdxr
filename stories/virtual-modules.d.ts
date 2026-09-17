declare module "virtual:mdxr-documents" {
  /** relative path (under examples/) → fully rendered standalone HTML */
  const documents: Record<string, string>;
  export default documents;
}
