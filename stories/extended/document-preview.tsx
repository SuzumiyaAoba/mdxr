/** These fixtures need the MDX compile pass before their components can render. */
export const DocumentPreview = ({
  html,
  title,
  allowPopups = false,
}: {
  html: string;
  title: string;
  allowPopups?: boolean;
}) => (
  <iframe
    className="block h-screen min-h-96 w-full border-0"
    sandbox={
      allowPopups
        ? "allow-scripts allow-downloads allow-popups"
        : "allow-scripts allow-downloads"
    }
    srcDoc={html}
    title={title}
  />
);
