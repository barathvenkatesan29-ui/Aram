const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export type SignInEmailValidationResult =
  | { ok: true; email: string }
  | { ok: false; message: string };

export function validateSignInEmail(
  email: string,
): SignInEmailValidationResult {
  const trimmedEmail = email.trim();

  if (trimmedEmail.length === 0) {
    return {
      ok: false,
      message: "Please enter your email address.",
    };
  }

  if (
    trimmedEmail.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(trimmedEmail)
  ) {
    return {
      ok: false,
      message: "Please enter a valid email address.",
    };
  }

  return {
    ok: true,
    email: trimmedEmail.toLowerCase(),
  };
}
