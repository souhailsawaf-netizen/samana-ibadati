import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

const PASSWORD_KEY_LENGTH = 64;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, PASSWORD_KEY_LENGTH, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, saltHex, keyHex, extra] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    extra !== undefined ||
    !saltHex ||
    !keyHex ||
    !/^[a-f0-9]{32}$/i.test(saltHex) ||
    !/^[a-f0-9]{128}$/i.test(keyHex)
  ) {
    return false;
  }

  const expected = Buffer.from(keyHex, "hex");
  const actual = await deriveKey(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actual, expected);
}

function sessionKey(): Uint8Array {
  const configured = process.env.AUTH_SESSION_SECRET;
  const localFallback = process.env.VERCEL
    ? undefined
    : process.env.MANUS_JWT_SECRET;
  const secret = configured || localFallback;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("AUTH_SESSION_SECRET must contain at least 32 bytes");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: number, tokenVersion: number): Promise<string> {
  return new SignJWT({ ver: tokenVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(sessionKey());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<{ userId: number; tokenVersion: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), {
      algorithms: ["HS256"],
    });
    const userId = Number(payload.sub);
    const tokenVersion = payload.ver;
    if (
      !Number.isSafeInteger(userId) ||
      userId < 1 ||
      !Number.isSafeInteger(tokenVersion) ||
      Number(tokenVersion) < 0
    ) {
      return null;
    }
    return { userId, tokenVersion: Number(tokenVersion) };
  } catch {
    return null;
  }
}

export function makeLoginAttemptKey(username: string, ipAddress: string): string {
  const secret = sessionKey();
  const value = `${normalizeUsername(username)}\0${ipAddress}`;
  // HMAC keeps raw usernames and IP addresses out of the rate-limit table.
  return createHmac("sha256", secret).update(value).digest("hex");
}

export const AUTH_SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;
