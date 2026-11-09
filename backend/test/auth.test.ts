import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt } from "../src/utils/jwt";
import { hashPassword, verifyPassword } from "../src/utils/password";

describe("jwt", () => {
  it("signs and verifies round-trip", async () => {
    const token = await signJwt({ sub: 1, name: "Admin", email: "a@b.c", role: "admin" }, "secret");
    const payload = await verifyJwt(token, "secret");
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe(1);
    expect(payload!.role).toBe("admin");
  });

  it("rejects wrong secret", async () => {
    const token = await signJwt({ sub: 1, name: "x", email: "x", role: "admin" }, "secret");
    expect(await verifyJwt(token, "other")).toBeNull();
  });

  it("rejects tampered token", async () => {
    const token = await signJwt({ sub: 1, name: "x", email: "x", role: "admin" }, "secret");
    const parts = token.split(".");
    const tampered = `${parts[0]}.${Buffer.from(JSON.stringify({ sub: 2, role: "admin", exp: 9999999999 })).toString("base64url")}.${parts[2]}`;
    expect(await verifyJwt(tampered, "secret")).toBeNull();
  });

  it("rejects expired token", async () => {
    const token = await signJwt({ sub: 1, name: "x", email: "x", role: "admin" }, "secret", -10);
    expect(await verifyJwt(token, "secret")).toBeNull();
  });
});

describe("password", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("Password123!");
    expect(hash).toMatch(/^pbkdf2\$100000\$/);
    expect(await verifyPassword("Password123!", hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("Password123!");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("produces unique salts", async () => {
    const a = await hashPassword("Password123!");
    const b = await hashPassword("Password123!");
    expect(a).not.toBe(b);
  });
});
