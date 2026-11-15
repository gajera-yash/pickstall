import "server-only";

import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";

import { APP_NAME, OTP_LENGTH, OTP_TTL_SECONDS, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, SESSION_COOKIE_CACHE_SECONDS } from "@/lib/config";
import { appOriginFrom } from "@/lib/app-origin";
import { AccountDeletionBlocked, prepareAccountDeletion } from "@/lib/account/delete-account";
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
  // Development only (D-041): also trust the local or LAN address the app was opened on, so sign-in
  // works from 127.0.0.1, an IDE preview or another PC. Production trusts baseURL alone.
  trustedOrigins: (request) => (process.env.NODE_ENV === "development" && request ? [appOriginFrom(request.headers)] : []),
  secret: serverEnv.BETTER_AUTH_SECRET,
  // No `client` passed: transactions stay off, so a standalone local MongoDB works too.
  database: mongodbAdapter(mongoDb),
  // Password login is for buyers (D-037). Public sign-up stays OFF: a password is only ever created by
  // lib/auth/buyer-account.ts after the one-time link from the order email was checked.
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    autoSignIn: false,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
  },
  socialProviders: google,
  // Account deletion (D-074): Better Auth checks the session is fresh (signed in within a day), runs our
  // cleanup, then deletes the user and all sessions. A failed cleanup throws and stops the deletion.
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        try {
          await prepareAccountDeletion({ id: user.id, email: user.email ?? null });
        } catch (error) {
          throw new APIError("BAD_REQUEST", { message: error instanceof AccountDeletionBlocked ? error.message : "Your account could not be deleted. Please try again." });
        }
      },
    },
  },
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
