import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from '@/db/schema'
import { db } from "@/db";
import { sendPasswordResetEmail } from "@/lib/email";

/**
 * The app's own origin.
 *
 * Google redirects back to `${baseURL}/api/auth/callback/google`, so this value
 * has to match the origin registered in the Google Cloud console. Letting Better
 * Auth infer it from the request works locally but breaks on preview deploys,
 * where every deployment gets its own hostname that Google has never seen.
 */
const baseURL = process.env.BETTER_AUTH_URL?.trim() || "http://localhost:3000";

/**
 * Origins allowed to complete a sign-in.
 *
 * Without this, a redirect back to the app can be rejected as a cross-origin
 * request. Derived from the same base URL so there is a single source of truth
 * instead of a second list that can drift.
 */
const trustedOrigins = [
  baseURL,
  "https://internbird.sqrock.cloud",
].filter((origin, i, all) => all.indexOf(origin) === i);

export const auth = betterAuth({
  baseURL,
  trustedOrigins,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema
  }),

  /**
   * Google sign-in and sign-up.
   *
   * Left out entirely when the credentials are missing so the app still boots
   * with email/password alone — the buttons on the login and register pages
   * check this before offering Google.
   */
  ...(isGoogleConfigured()
    ? {
        socialProviders: {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
            /**
             * Better Auth already requests openid/email/profile by default, so
             * no scope override is set here — adding one produced a duplicated
             * scope string on the consent URL.
             */
            // Use the picture Google already returns instead of making the user
            // upload an avatar afterwards.
            mapProfileToUser: (profile: {
              name?: string;
              email?: string;
              picture?: string;
              email_verified?: boolean;
            }) => ({
              name: profile.name,
              email: profile.email,
              image: profile.picture,
              emailVerified: profile.email_verified,
            }),
          },
        },
      }
    : {}),

  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({
        to: user.email,
        userName: user.name,
        resetUrl: url,
      })
    },
    resetPasswordTokenExpiresIn: 60 * 60,
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        // Anyone arriving through Google is a regular student. Admins are only
        // created through the admin registration flow, never by signing up.
        defaultValue: "user",
      },
    },
  },
});

/** True when Google credentials are present, so the UI can hide the button. */
function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}