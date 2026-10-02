/** Read the current key first, retaining access to records saved by older builds. */
export const legacyStorageKey = (key: string): string =>
  key.replace(/^doc(?=[:-])/u, ["md", "xr"].join(""));

export const readDocumentStorage = (
  storage: Storage,
  key: string
): string | null =>
  storage.getItem(key) ?? storage.getItem(legacyStorageKey(key));

export const removeDocumentStorage = (storage: Storage, key: string): void => {
  storage.removeItem(key);
  storage.removeItem(legacyStorageKey(key));
};
