/** These fixtures need the MDX compile pass before their components can render. */
export const DocumentPreview = ({
  html,
  title,
}: {
  html: string;
  title: string;
}) => (
  <iframe
    className="block h-screen min-h-96 w-full border-0"
    sandbox="allow-scripts allow-downloads"
    srcDoc={html}
    title={title}
  />
);
