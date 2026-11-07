import applicationsHandler from "../_lib/ris/applicationsHandler.mjs";
import consentsHandler from "../_lib/ris/consentsHandler.mjs";

/**
 * Single Vercel entry point for the two public RIS BFF routes:
 *
 *   /api/ris/applications -> applicationsHandler
 *   /api/ris/consents     -> consentsHandler
 *
 * The rewrites in vercel.json set exactly one internal flag. The router also
 * checks the original pathname when Vercel preserves it. A client-supplied
 * route flag cannot switch handlers: conflicting flags or a path/flag mismatch
 * are rejected with 404.
 */
const ROUTES = new Map([
  ["applications", applicationsHandler],
  ["consents", consentsHandler],
]);

const ROUTE_FLAGS = new Map([
  ["applications", "__ris_applications"],
  ["consents", "__ris_consents"],
]);

function pathRoute(req) {
  try {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (pathname === "/api/ris/applications") return "applications";
    if (pathname === "/api/ris/consents") return "consents";
  } catch {
    return "";
  }
  return "";
}

function flagRoute(req) {
  const active = [];
  for (const [route, flag] of ROUTE_FLAGS) {
    const value = req.query?.[flag];
    if (value === undefined) continue;
    if (typeof value !== "string" || value !== "1") return { route: "", invalid: true };
    active.push(route);
  }
  if (active.length === 0) return { route: "", invalid: false };
  if (active.length === 1) return { route: active[0], invalid: false };
  return { route: "", invalid: true };
}

function reject(res) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(404).json({ error: "Not found", code: "not_found" });
}

export default async function handler(req, res) {
  const fromPath = pathRoute(req);
  const flag = flagRoute(req);
  if (flag.invalid) return reject(res);
  const fromFlag = flag.route;

  if (!fromPath && !fromFlag) return reject(res);
  if (fromPath && fromFlag && fromPath !== fromFlag) return reject(res);

  const route = fromPath || fromFlag;
  const routeHandler = ROUTES.get(route);
  if (!routeHandler) return reject(res);

  return routeHandler(req, res);
}
