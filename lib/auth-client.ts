import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // Mirrors `user.additionalFields` in lib/auth.ts so `session.user.role`
  // is typed on the client as well as the server.
  plugins: [
    inferAdditionalFields({ user: { role: { type: "string" } } }),
  ],
});

export const { signIn, signUp, useSession } = authClient;
