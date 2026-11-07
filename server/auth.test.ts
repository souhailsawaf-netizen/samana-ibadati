import { afterEach, describe, expect, it } from "vitest";
import {
  createSessionToken,
  hashPassword,
  makeLoginAttemptKey,
  verifyPassword,
  verifySessionToken,
} from "./auth";

const previousSecret = process.env.AUTH_SESSION_SECRET;
const previousVercel = process.env.VERCEL;

afterEach(() => {
  if (previousSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
  else process.env.AUTH_SESSION_SECRET = previousSecret;
  if (previousVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = previousVercel;
});

describe("local account security", () => {
  it("stores a salted scrypt hash rather than the password", async () => {
    const password = "a strong test password";
    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    expect(firstHash).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(firstHash).not.toBe(password);
    expect(secondHash).not.toBe(firstHash);
    await expect(verifyPassword(password, firstHash)).resolves.toBe(true);
    await expect(verifyPassword("incorrect password", firstHash)).resolves.toBe(false);
  });

  it("signs a session with the current token version and rejects tampering", async () => {
    process.env.VERCEL = "1";
    process.env.AUTH_SESSION_SECRET = "unit-test-only-secret-with-at-least-32-bytes";
    const token = await createSessionToken(42, 3);

    await expect(verifySessionToken(token)).resolves.toEqual({
      userId: 42,
      tokenVersion: 3,
    });
    const [header, payload, signature] = token.split(".");
    const alteredToken = `${header}.${payload}.${signature?.startsWith("a") ? "b" : "a"}${signature?.slice(1)}`;
    await expect(verifySessionToken(alteredToken)).resolves.toBeNull();
  });

  it("stores only a keyed digest for the login throttling identity", () => {
    process.env.VERCEL = "1";
    process.env.AUTH_SESSION_SECRET = "unit-test-only-secret-with-at-least-32-bytes";
    const key = makeLoginAttemptKey("Student_24", "192.0.2.1");

    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("Student_24");
    expect(key).not.toContain("192.0.2.1");
    expect(key).toBe(makeLoginAttemptKey("student_24", "192.0.2.1"));
  });
});
