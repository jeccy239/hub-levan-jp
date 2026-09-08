import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Protect everything except the login page, NextAuth's own API routes,
  // the email open/click trackers and the images embedded in outbound mail
  // (all three are fetched by recipients' mail clients, which have no
  // session — gating them means the pixel never fires and every image in
  // every email renders broken), and Next.js internals/static assets.
  matcher: ["/((?!login|api/auth|api/track|mail/|_next/static|_next/image|favicon.ico).*)"],
};
