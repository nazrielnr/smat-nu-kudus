import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppEnv } from "../types";
import { unauthorized, badRequest, extractToken, requireAuth } from "../middleware/auth";
import { loginSchema, changePasswordSchema } from "../validators";
import { usersRepo } from "../repositories/users";
import { auditRepo } from "../repositories/audit";
import { verifyPassword, hashPassword } from "../utils/password";
import { signJwt, verifyJwt } from "../utils/jwt";

const SESSION_COOKIE = "session";
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { email, password } = parsed.data;
  const db = c.env.DB;
  const users = usersRepo(db);
  const audit = auditRepo(db);
  const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? null;

  const user = await users.findByEmail(email.toLowerCase());
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await audit.recordLoginAttempt(email, false, ip);
    throw unauthorized("Email atau password salah");
  }
  if (!user.is_active) {
    await audit.recordLoginAttempt(email, false, ip);
    throw unauthorized("Akun tidak aktif");
  }
  await audit.recordLoginAttempt(email, true, ip);

  const token = await signJwt(
    { sub: user.id, name: user.name, email: user.email, role: user.role },
    c.env.SESSION_SECRET,
    SEVEN_DAYS_SECONDS
  );
  const payload = await verifyJwt(token, c.env.SESSION_SECRET);

  await audit.insertSession({
    token_id: payload!.jti,
    user_id: user.id,
    expires_at: new Date(payload!.exp * 1000).toISOString().replace("T", " ").slice(0, 19),
    user_agent: c.req.header("User-Agent") ?? null,
    ip_address: ip,
  });
  await audit.write({ id: user.id, name: user.name }, "login", "user", user.id, { email }, ip);

  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:", // true in production (https), false for local http
    sameSite: "Lax",
    path: "/",
    maxAge: SEVEN_DAYS_SECONDS,
  });

  return c.json({
    success: true,
    data: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

authRoutes.get("/me", async (c) => {
  const token = extractToken(c);
  if (!token) throw unauthorized();
  const payload = await verifyJwt(token, c.env.SESSION_SECRET);
  if (!payload) throw unauthorized("Invalid or expired session");
  const user = await usersRepo(c.env.DB).findById(payload.sub);
  if (!user || !user.is_active) throw unauthorized("User not found or inactive");
  return c.json({
    success: true,
    data: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

authRoutes.post("/logout", async (c) => {
  const token = extractToken(c);
  if (token) {
    const payload = await verifyJwt(token, c.env.SESSION_SECRET);
    if (payload) {
      await auditRepo(c.env.DB).revokeSession(payload.jti);
      await auditRepo(c.env.DB).write(
        { id: payload.sub, name: payload.name },
        "logout", "user", payload.sub, null, null
      );
    }
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ success: true, data: { message: "Logged out" } });
});

authRoutes.post("/change-password", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const current = c.get("currentUser");
  const users = usersRepo(c.env.DB);
  const user = await users.findById(current.id);
  if (!user) throw unauthorized();
  if (!(await verifyPassword(parsed.data.current_password, user.password_hash))) {
    throw badRequest("Password saat ini salah");
  }
  const newHash = await hashPassword(parsed.data.new_password);
  await users.update(user.id, { password_hash: newHash });
  await auditRepo(c.env.DB).write(current, "change_password", "user", user.id, null, null);
  return c.json({ success: true, data: { message: "Password changed" } });
});
