import { getCaseIdFromPathname, getChatIdFromPathname } from "@/features/cases/parseCaseId";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getProtectedNextPath(pathname: string): string | null {
  if (pathname === "/start" || pathname.startsWith("/start/")) {
    return "/chat";
  }

  if (pathname === "/cases" || pathname === "/cases/") {
    return "/chat";
  }

  if (pathname === "/chat" || pathname === "/chat/") {
    return "/chat";
  }

  if (pathname === "/chat/archived" || pathname.startsWith("/chat/archived/")) {
    return "/chat/archived";
  }

  const caseId = getCaseIdFromPathname(pathname);

  if (caseId) {
    return `/chat/${caseId}`;
  }

  const chatId = getChatIdFromPathname(pathname);

  if (chatId) {
    return `/chat/${chatId}`;
  }

  if (pathname.startsWith("/cases/")) {
    return "/chat";
  }

  if (pathname.startsWith("/chat/")) {
    return "/chat";
  }

  return null;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    },
  );

  // Refresh the session before the app renders. Do not add logic between
  // createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);
  const nextPath = getProtectedNextPath(request.nextUrl.pathname);

  if (!isSignedIn && nextPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    url.searchParams.set("next", nextPath);

    const redirectResponse = NextResponse.redirect(url);

    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  return supabaseResponse;
}
