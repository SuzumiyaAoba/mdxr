export type CodexAppServerErrorKind = "general" | "session-conflict";

export class CodexAppServerError extends Error {
  readonly kind: CodexAppServerErrorKind;

  constructor(
    message: string,
    kind: CodexAppServerErrorKind = "general",
    options?: ErrorOptions
  ) {
    super(message, options);
    this.kind = kind;
    this.name = "CodexAppServerError";
  }
}
