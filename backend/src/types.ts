export type Role = "admin" | "bendahara" | "pengelola_aset" | "pemeriksa" | "pimpinan";

export const ROLES: Role[] = [
  "admin",
  "bendahara",
  "pengelola_aset",
  "pemeriksa",
  "pimpinan",
];

export interface Bindings {
  DB: D1Database;
  BUCKET: R2Bucket;
  SESSION_SECRET: string;
  CORS_ORIGIN?: string;
}

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

/** Hono environment: bindings + per-request variables. */
export interface AppEnv {
  Bindings: Bindings;
  Variables: {
    currentUser: CurrentUser;
  };
}
