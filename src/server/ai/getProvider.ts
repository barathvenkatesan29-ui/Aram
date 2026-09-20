import { stubProvider } from "./stubProvider.ts";
import type { ProviderResolution } from "./types.ts";

export type ProviderEnv = {
  NODE_ENV?: string;
  SITUATION_UNDERSTANDING_ALLOW_STUB?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

function isLocalDevelopmentSiteUrl(siteUrl: string): boolean {
  const trimmedSiteUrl = siteUrl.trim();

  if (trimmedSiteUrl.length === 0) {
    return false;
  }

  try {
    const parsedUrl = new URL(trimmedSiteUrl);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return false;
    }

    return (
      parsedUrl.hostname === "localhost" ||
      parsedUrl.hostname === "127.0.0.1" ||
      parsedUrl.hostname === "[::1]" ||
      parsedUrl.hostname === "::1"
    );
  } catch {
    return false;
  }
}

function isStubAllowed(env: ProviderEnv): boolean {
  return (
    env.SITUATION_UNDERSTANDING_ALLOW_STUB === "true" &&
    env.NODE_ENV === "development" &&
    isLocalDevelopmentSiteUrl(env.NEXT_PUBLIC_SITE_URL ?? "")
  );
}

export function resolveProvider(env: ProviderEnv): ProviderResolution {
  if (isStubAllowed(env)) {
    return { ok: true, provider: stubProvider };
  }

  return { ok: false, failureCode: "unavailable" };
}

export function getProvider(): ProviderResolution {
  return resolveProvider(process.env);
}
