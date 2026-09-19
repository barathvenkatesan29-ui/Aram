export const AUTH_NEXT_COOKIE_NAME = "aram_auth_next";

const AUTH_NEXT_COOKIE_MAX_AGE_SECONDS = 60 * 60;

function isSecureAuthCookie(): boolean {
  return process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://") === true;
}

export function getAuthNextCookieOptions(): {
  httpOnly: true;
  path: "/";
  sameSite: "lax";
  secure: boolean;
  maxAge: number;
} {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureAuthCookie(),
    maxAge: AUTH_NEXT_COOKIE_MAX_AGE_SECONDS,
  };
}

export function getAuthNextCookieDeleteOptions(): {
  httpOnly: true;
  path: "/";
  sameSite: "lax";
  secure: boolean;
  maxAge: 0;
} {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureAuthCookie(),
    maxAge: 0,
  };
}
