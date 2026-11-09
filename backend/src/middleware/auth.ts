import type { Context, Next } from "hono";
import type { AppEnv, Role } from "../types";
import { verifyJwt, type JwtPayload } from "../utils/jwt";

export class HttpError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg: string) => new HttpError(400, "BAD_REQUEST", msg);
export const unauthorized = (msg = "Not authenticated") =>
  new HttpError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "Forbidden") => new HttpError(403, "FORBIDDEN", msg);
export const notFound = (msg = "Not found") => new HttpError(404, "NOT_FOUND", msg);
export const conflict = (msg: string, code = "CONFLICT") => new HttpError(409, code, msg);

export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const token = extractToken(c);
  if (!token) throw unauthorized();
  const payload = await verifyJwt(token, c.env.SESSION_SECRET);
  if (!payload) throw unauthorized("Invalid or expired session");
  c.set("currentUser", {
    id: payload.sub,
    name: payload.name,
    email: payload.email,
    role: payload.role as Role,
  });
  await next();
}

export function extractToken(c: Context<AppEnv>): string | null {
  const cookie = c.req.header("Cookie");
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
    if (match) return match[1]!;
  }
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export function requireRoles(...roles: string[]) {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = c.get("currentUser");
    if (!roles.includes(user.role)) {
      throw forbidden(`Role '${user.role}' tidak diizinkan untuk aksi ini`);
    }
    await next();
  };
}

export function errorResponse(err: unknown, c: Context) {
  if (err instanceof HttpError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409
    );
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[unhandled]", err);
  return c.json({ success: false, error: { code: "INTERNAL", message } }, 500);
}
