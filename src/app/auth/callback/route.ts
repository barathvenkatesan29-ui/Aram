import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_NEXT_COOKIE_NAME,
  getAuthNextCookieDeleteOptions,
} from "@/features/auth/authNextCookie";
import { getSafeNextPath } from "@/features/auth/safeNextPath";
import { createClient } from "@/lib/supabase/server";

function deleteAuthNextCookie(response: NextResponse) {
  response.cookies.set(AUTH_NEXT_COOKIE_NAME, "", getAuthNextCookieDeleteOptions());
}

function redirectAfterCallback(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const response = NextResponse.redirect(url);
  deleteAuthNextCookie(response);
  return response;
}

function redirectToSignIn(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  url.searchParams.set("error", "auth");
  const response = NextResponse.redirect(url);
  deleteAuthNextCookie(response);
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const flowId = searchParams.get("sb_flow_id");
  const nextPath = getSafeNextPath(
    request.cookies.get(AUTH_NEXT_COOKIE_NAME)?.value,
  );

  if (searchParams.get("error") || !code) {
    return redirectToSignIn(request);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );

  if (error) {
    console.error("exchangeCodeForSession failed", {
      name: error.name,
      status: error.status,
    });
    return redirectToSignIn(request);
  }

  return redirectAfterCallback(request, nextPath);
}
