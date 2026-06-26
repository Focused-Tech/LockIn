import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/firebase/config";

/** firebase-admin needs the Node.js runtime (not Edge). */
export const runtime = "nodejs";

/** Mint an httpOnly session cookie from a Firebase ID token (login + post-signup). */
export async function POST(request: NextRequest) {
  const { idToken } = (await request.json()) as { idToken?: string };
  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  try {
    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
  }
}

/** Clear the session cookie (sign out). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
