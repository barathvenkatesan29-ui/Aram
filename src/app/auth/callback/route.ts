import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function redirectToSignIn(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  url.searchParams.set("error", "auth");
  return NextResponse.redirect(url);
}

function redirectToStart(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/start";
  url.search = "";
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const flowId = searchParams.get("sb_flow_id");

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

  return redirectToStart(request);
}
