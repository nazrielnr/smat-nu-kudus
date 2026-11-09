import { Hono } from "hono";
import type { AppEnv } from "../types";

export const settingsRoutes = new Hono<AppEnv>();

/** Nama organisasi (untuk kop cetak/PDF). Boleh dibaca semua user yang login. */
settingsRoutes.get("/org", async (c) => {
  const row = await c.env.DB
    .prepare("SELECT value FROM settings WHERE key = 'org_name'")
    .first<{ value: string }>();
  return c.json({ success: true, data: { name: row?.value ?? "" } });
});
