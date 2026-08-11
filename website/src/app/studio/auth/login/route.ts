import { NextResponse, type NextRequest } from "next/server";
import { getOidcClient, startPkce, codeChallenge } from "@/lib/studio-oidc";
import { signPkceCookie } from "@/lib/studio-session";

function safeReturnTo(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const origin = request.nextUrl.origin;

  const oidc = await getOidcClient(origin);
  const pkce = startPkce(returnTo);

  const authUrl = oidc.authorizationUrl({
    scope: "openid email",
    state: pkce.state,
    code_challenge: codeChallenge(pkce.verifier),
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(authUrl);
  const cookie = await signPkceCookie(pkce);
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: cookie.maxAge,
  });
  return response;
}
