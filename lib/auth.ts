import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from '@/db/schema'
import { db } from "@/db";
import { sendPasswordResetEmail } from "@/lib/email";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema
  }),

  // IMPORTANT: ye add karo
  // baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  // trustedOrigins: [
  //   "http://localhost:3000",
  //   "https://internbird.sqrock.cloud",
  // ],

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
        defaultValue: "user",
      },
    },
  },
});