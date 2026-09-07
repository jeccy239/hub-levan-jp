import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Protect everything except the login page, NextAuth's own API routes,
  // the email open/click trackers (hit by recipients' mail clients, who are
  // by definition not logged in), and Next.js internals/static assets.
  matcher: ["/((?!login|api/auth|api/track|_next/static|_next/image|favicon.ico).*)"],
};
