import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireRoles, badRequest, notFound, forbidden } from "../middleware/auth";
import { createUserSchema, updateUserSchema, userStatusSchema } from "../validators";
import { usersRepo } from "../repositories/users";
import { auditRepo } from "../repositories/audit";
import { hashPassword } from "../utils/password";
import { parsePageQuery, buildPage } from "../utils/pagination";

export const userRoutes = new Hono<AppEnv>();

function publicUser(u: { id: number; name: string; email: string; role: string; is_active: number; created_at: string; updated_at: string }) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    is_active: !!u.is_active, created_at: u.created_at, updated_at: u.updated_at,
  };
}

userRoutes.use("*", requireRoles("admin"));

userRoutes.get("/", async (c) => {
  const q = parsePageQuery(c.req.url);
  const { items, total } = await usersRepo(c.env.DB).list({
    q: c.req.query("q"),
    role: c.req.query("role"),
    is_active: c.req.query("is_active") === undefined ? undefined : c.req.query("is_active") === "true" ? 1 : 0,
    limit: q.limit,
    offset: q.offset,
  });
  return c.json({ success: true, data: buildPage(items.map(publicUser), total, q) });
});

userRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const data = parsed.data;
  const users = usersRepo(c.env.DB);
  if (await users.findByEmail(data.email.toLowerCase())) {
    throw badRequest("Email sudah digunakan");
  }
  const created = await users.create({
    name: data.name,
    email: data.email.toLowerCase(),
    password_hash: await hashPassword(data.password),
    role: data.role as never,
  });
  await auditRepo(c.env.DB).write(c.get("currentUser"), "user_create", "user", created.id, { email: created.email, role: created.role }, null);
  return c.json({ success: true, data: publicUser(created) }, 201);
});

userRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const user = await usersRepo(c.env.DB).findById(id);
  if (!user) throw notFound("User tidak ditemukan");
  return c.json({ success: true, data: publicUser(user) });
});

userRoutes.put("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const body = await c.req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const data = parsed.data;
  const users = usersRepo(c.env.DB);
  const existing = await users.findById(id);
  if (!existing) throw notFound("User tidak ditemukan");
  if (data.email && data.email.toLowerCase() !== existing.email) {
    const dupe = await users.findByEmail(data.email.toLowerCase());
    if (dupe) throw badRequest("Email sudah digunakan");
  }
  const updated = await users.update(id, {
    name: data.name,
    email: data.email?.toLowerCase(),
    role: data.role as never | undefined,
    password_hash: data.password ? await hashPassword(data.password) : undefined,
  });
  await auditRepo(c.env.DB).write(c.get("currentUser"), "user_update", "user", id, { fields: Object.keys(data) }, null);
  return c.json({ success: true, data: publicUser(updated) });
});

userRoutes.patch("/:id/status", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id");
  const body = await c.req.json().catch(() => null);
  const parsed = userStatusSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const users = usersRepo(c.env.DB);
  const existing = await users.findById(id);
  if (!existing) throw notFound("User tidak ditemukan");
  const current = c.get("currentUser");
  if (existing.id === current.id && !parsed.data.is_active) {
    throw forbidden("Tidak dapat menonaktifkan akun sendiri");
  }
  const updated = await users.update(id, { is_active: parsed.data.is_active ? 1 : 0 });
  await auditRepo(c.env.DB).write(current, "user_status", "user", id, { is_active: parsed.data.is_active }, null);
  return c.json({ success: true, data: publicUser(updated) });
});
