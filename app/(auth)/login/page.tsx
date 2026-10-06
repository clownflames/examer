import LoginForm from "./login-form";

/**
 * Server shell for the login page.
 *
 * It exists to pass one thing down: whether Google credentials are configured.
 * The check stays on the server so the client bundle never learns whether
 * secrets exist, and so the Google button can be hidden instead of failing
 * after the user taps it.
 */
export default function LoginPage() {
  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );

  return <LoginForm googleEnabled={googleEnabled} />;
}