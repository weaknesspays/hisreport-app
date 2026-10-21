import { SignJWT, jwtVerify } from "jose";
import { SESSION_HOURS } from "./config";

// ใช้ได้ทั้ง middleware (edge) และ server
export type SessionPayload = { uid: number; username: string };
export type VerifiedSession = SessionPayload & { iat: number }; // iat = วินาที (ออก session เมื่อไร)

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร");
  return new TextEncoder().encode(secret);
}

export async function signSession(p: SessionPayload) {
  return new SignJWT(p)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<VerifiedSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (typeof payload.uid !== "number" || typeof payload.username !== "string") return null;
    return { uid: payload.uid, username: payload.username, iat: Number(payload.iat ?? 0) };
  } catch {
    return null;
  }
}
