import { createMiddleware } from "hono/factory";

/** Header used to propagate a request-correlation id across services. */
export const CALL_ID_HEADER = "x-call-id";

/**
 * Honor an incoming `x-call-id`, otherwise mint one. The id is stored on the
 * context (`c.get("callId")`), echoed in the response header, and included in
 * structured logs and response envelopes for end-to-end correlation.
 */
export const callId = createMiddleware<{ Variables: { callId: string } }>(async (c, next) => {
  const incoming = c.req.header(CALL_ID_HEADER)?.trim();
  const id = incoming && incoming.length > 0 ? incoming.slice(0, 128) : crypto.randomUUID();
  c.set("callId", id);
  c.header(CALL_ID_HEADER, id);
  await next();
});
