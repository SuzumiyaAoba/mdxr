import { useEffect } from "react";

/** Restore DOM-owned widgets only after React has completed hydration. */
export const HydrationReady = () => {
  useEffect(() => {
    document.dispatchEvent(new Event("mdxr:hydrated"));
  }, []);
  return null;
};
