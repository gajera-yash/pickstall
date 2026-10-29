import "server-only";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";

import { APP_NAME, OTP_LENGTH, OTP_TTL_SECONDS, SESSION_COOKIE_CACHE_SECONDS } from "@/lib/config";
import { mongoDb } from "@/lib/db/mongo";
import { sendSignInCode } from "@/lib/email/send-sign-in-code";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

// Auth (D-024): Better Auth on MongoDB. Email 6-digit code (D-002) and Google. No passwords.
// App code calls `auth.api.*` from server actions; `nextCookies()` writes the session cookie there.

const google =
  serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: serverEnv.GOOGLE_CLIENT_ID, clientSecret: serverEnv.GOOGLE_CLIENT_SECRET } }
    : undefined;

export const auth = betterAuth({
  appName: APP_NAME,
  baseURL: publicEnv.NEXT_PUBLIC_APP_URL,
  secret: serverEnv.BETTER_AUTH_SECRET,
  // No `client` passed: transactions stay off, so a standalone local MongoDB works too.
  database: mongodbAdapter(mongoDb),
  emailAndPassword: { enabled: false },
  socialProviders: google,
  // Speed (2026-10-29, founder approved): the session is also kept in a signed cookie (HMAC,
  // Better Auth's "compact" strategy) for a few minutes, so most page loads skip the database
  // session lookup. Trade-off: a session ended elsewhere (sign out on another device) can keep
  // working on this device until the cookie expires. Signing out here clears it at once.
  session: { cookieCache: { enabled: true, maxAge: SESSION_COOKIE_CACHE_SECONDS } },
  // Limits the public /api/auth/* endpoints. Stored in MongoDB so it holds across server instances.
  rateLimit: { enabled: true, storage: "database" },
  plugins: [
    emailOTP({
      otpLength: OTP_LENGTH,
      expiresIn: OTP_TTL_SECONDS,
      allowedAttempts: 5,
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "sign-in") return;
        await sendSignInCode(email, otp);
      },
    }),
    nextCookies(), // must stay last
  ],
});
