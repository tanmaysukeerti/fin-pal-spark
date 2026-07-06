import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";

// CSRF defense: reject state-changing requests whose Origin doesn't match Host.
const securityMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    const req = getRequest();
    const method = (req.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      const origin = req.headers.get("origin");
      const host = req.headers.get("host");
      if (origin && host) {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return new Response("Forbidden: cross-origin request blocked", { status: 403 });
        }
      }
    }
  } catch {
    // If we can't read the request, fall through — don't break SSR.
  }
  return next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityMiddleware, errorMiddleware],
}));
