import { NextResponse } from "next/server";
import { createSessionToken, COOKIE_NAME } from "@/lib/auth";
import { timingSafeEqual } from "crypto";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    const expected = process.env.DASHBOARD_PASSWORD;
    if (!expected) {
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      );
    }

    const inputBuf = Buffer.from(password ?? "");
    const expectedBuf = Buffer.from(expected);

    const isValid =
      inputBuf.length === expectedBuf.length &&
      timingSafeEqual(inputBuf, expectedBuf);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    const token = await createSessionToken();
    const response = NextResponse.json({ success: true });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
