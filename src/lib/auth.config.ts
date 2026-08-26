import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe subset of the auth config — no Prisma/bcrypt here, since
 * middleware runs on the Edge runtime and can't bundle Node-only deps.
 * The Credentials provider (which needs Prisma) lives in auth.ts instead.
 */
export default {
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user;
      const isLoginPage = request.nextUrl.pathname.startsWith("/login");
      if (isLoginPage) return true;
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
