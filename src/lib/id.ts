/** Generate a UUID id in the app layer so Neon + in-memory repos match. */
export function newId(): string {
  // crypto.randomUUID is available in Node 18+, modern browsers, and edge runtimes.
  return crypto.randomUUID();
}
