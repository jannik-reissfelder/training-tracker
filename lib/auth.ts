import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHmac } from "node:crypto";

const SESSION_COOKIE = "session";
const SESSION_SALT = "training-tracker-session";

function getSessionKey() {
  const passphrase = process.env.APP_PASSPHRASE;
  if (!passphrase) {
    throw new Error("APP_PASSPHRASE is not set");
  }
  return createHmac("sha256", passphrase).update(SESSION_SALT).digest();
}

export async function createSession() {
  const key = getSessionKey();
  const token = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function verifySession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return false;

    const key = getSessionKey();
    const { payload } = await jwtVerify(token, key);
    return payload.authenticated === true;
  } catch {
    return false;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
