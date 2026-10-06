import RegistrationForm from "./register-form";

/**
 * Server shell for the registration page.
 *
 * Mirrors the login page: it passes down whether Google is configured so the
 * button can be hidden rather than failing on tap.
 */
export default function RegisterPage() {
  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );

  return <RegistrationForm googleEnabled={googleEnabled} />;
}