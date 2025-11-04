import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GitHub from "next-auth/providers/github";

import { getAuthConfig } from "@/envs/auth";
import { getServerDBConfig } from "@/envs/serverDB";

const {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  NEXT_AUTH_DEBUG,
  NEXT_AUTH_SECRET,
  NEXT_AUTH_SSO_SESSION_STRATEGY,
} = getAuthConfig();

const { NEXT_PUBLIC_ENABLED_SERVER_SERVICE } = getServerDBConfig();

// Notice this is only an object, not a full Auth.js instance
const authConfig = {
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user?.id) {
        token.userId = user.id;
      }
      return token;
    },
    async session({
      session,
      token,
      user,
    }: {
      session: Session;
      token: JWT;
      user?: User;
    }) {
      if (session.user) {
        if (user) {
          (session.user as unknown as { id?: string }).id = user.id as string;
        } else {
          (session.user as unknown as { id?: string }).id = (token.userId ??
            (session.user as unknown as { id?: string }).id) as string;
        }
      }
      return session;
    },
  },
  debug: NEXT_AUTH_DEBUG,
  pages: {
    error: "/next-auth/error",
    signIn: "/next-auth/signin",
  },
  providers: [
    GitHub({
      authorization: { params: { scope: "read:user user:email" } },
      clientId: GITHUB_CLIENT_ID ?? process.env.AUTH_GITHUB_ID ?? "",
      clientSecret: GITHUB_CLIENT_SECRET ?? process.env.AUTH_GITHUB_SECRET ?? "",
      profile: (profile) => {
        return {
          email: profile.email,
          id: profile.id.toString(),
          image: profile.avatar_url,
          name: profile.name,
          providerAccountId: profile.id.toString(),
        };
      },
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  secret: NEXT_AUTH_SECRET,
  session: {
    // Force use JWT if server service is disabled
    strategy: NEXT_PUBLIC_ENABLED_SERVER_SERVICE
      ? NEXT_AUTH_SSO_SESSION_STRATEGY
      : "jwt",
  },
  trustHost: process.env?.AUTH_TRUST_HOST
    ? process.env.AUTH_TRUST_HOST === "true"
    : true,
};

export default authConfig;
