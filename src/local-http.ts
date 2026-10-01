import type http from "node:http";

/** Match the loopback server's Host and, when present, Origin headers. */
export const isLocalOrigin = (request: http.IncomingMessage): boolean => {
  const port = request.socket.localPort;
  const host = request.headers.host ?? "";
  return (
    (host === `localhost:${port}` || host === `127.0.0.1:${port}`) &&
    (request.headers.origin === undefined ||
      request.headers.origin === `http://${host}`)
  );
};

export const replyText = (
  response: http.ServerResponse,
  status: number,
  body: string,
  contentType: string,
  headers: http.OutgoingHttpHeaders = {}
): void => {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": contentType,
    "x-content-type-options": "nosniff",
    ...headers,
  });
  response.end(body);
};

export const replyJson = (
  response: http.ServerResponse,
  status: number,
  body: unknown,
  headers: http.OutgoingHttpHeaders = {}
): void => {
  replyText(
    response,
    status,
    JSON.stringify(body),
    "application/json; charset=utf-8",
    headers
  );
};
