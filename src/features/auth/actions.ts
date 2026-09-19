"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  AUTH_NEXT_COOKIE_NAME,
  getAuthNextCookieOptions,
} from "./authNextCookie";
import { getSafeNextPath } from "./safeNextPath";
import { validateSignInEmail } from "./validateSignInEmail";

export type SendMagicLinkResult =
  | { ok: true }
  | { ok: false; message: string };

function getAuthCallbackUrl(): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!siteUrl) {
    return null;
  }

  return `${siteUrl.replace(/\/$/, "")}/auth/callback`;
}

export async function sendMagicLink(
  email: string,
  nextPath?: string,
): Promise<SendMagicLinkResult> {
  const validation = validateSignInEmail(email);

  if (!validation.ok) {
    return {
      ok: false,
      message: validation.message,
    };
  }

  const emailRedirectTo = getAuthCallbackUrl();

  if (!emailRedirectTo) {
    console.error("sendMagicLink failed", { reason: "missing-site-url" });
    return {
      ok: false,
      message: "Something went wrong. Please try again.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: validation.email,
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error("signInWithOtp failed", {
      name: error.name,
      status: error.status,
    });
    return {
      ok: false,
      message:
        "We could not send a sign-in email right now. Wait a minute and try again.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    AUTH_NEXT_COOKIE_NAME,
    getSafeNextPath(nextPath),
    getAuthNextCookieOptions(),
  );

  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    console.error("signOut failed", {
      name: error.name,
      status: error.status,
    });
  }

  redirect("/");
}
