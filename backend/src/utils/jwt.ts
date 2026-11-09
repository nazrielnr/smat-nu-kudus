import { base64UrlDecode, base64UrlEncode, encode } from "./b64";

export interface JwtPayload {
  sub: number;
  name: string;
  email: string;
  role: string;
  jti: string;
  iat: number;
  exp: number;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(data: Uint8Array, secret: string): Promise<Uint8Array> {
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, data as BufferSource));
  return sig;
}

/** Sign a JWT (HS256). Expiry in seconds (default 7d). */
export async function signJwt(
  payload: Omit<JwtPayload, "jti" | "iat" | "exp">,
  secret: string,
  expiresInSeconds = 7 * 24 * 60 * 60
): Promise<string> {
  const header = base64UrlEncode(encode({ alg: "HS256", typ: "JWT" }));
  const full: JwtPayload = {
    ...payload,
    jti: crypto.randomUUID(),
    iat: nowSeconds(),
    exp: nowSeconds() + expiresInSeconds,
  };
  const body = base64UrlEncode(encode(full));
  const signingInput = new TextEncoder().encode(`${header}.${body}`);
  const signature = base64UrlEncode(await sign(signingInput, secret));
  return `${header}.${body}.${signature}`;
}

/** Verify a JWT. Returns null when invalid or expired. */
export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const signingInput = new TextEncoder().encode(`${header}.${body}`);
  const expected = await sign(signingInput, secret);
  const provided = base64UrlDecode(signature);
  if (expected.length !== provided.length) return null;
  // constant-time-ish compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ provided[i];
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as JwtPayload;
    if (typeof payload.exp !== "number" || payload.exp < nowSeconds()) return null;
    if (typeof payload.sub !== "number") return null;
    return payload;
  } catch {
    return null;
  }
}
