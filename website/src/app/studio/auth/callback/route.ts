import { NextResponse, type NextRequest } from "next/server";
import { getOidcClient } from "@/lib/studio-oidc";
import {
  PKCE_COOKIE,
  readPkceCookie,
  createStudioSessionCookie,
} from "@/lib/studio-session";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = Object.fromEntries(request.nextUrl.searchParams);

  if (params.error) {
    return NextResponse.redirect(new URL("/?authStatus=error", origin));
  }

  const pkce = await readPkceCookie(request.cookies.get(PKCE_COOKIE)?.value);
  if (!pkce || pkce.state !== params.state) {
    return NextResponse.redirect(new URL("/?authStatus=error", origin));
  }

  const oidc = await getOidcClient(origin);
  const tokenSet = await oidc.callback(`${origin}/auth/callback`, params, {
    state: pkce.state,
    code_verifier: pkce.verifier,
  });

  const idClaims = tokenSet.claims();
  if (!idClaims.sub) {
    return NextResponse.redirect(new URL("/?authStatus=error", origin));
  }

  // Email vem do userinfo, não do ID token (mesma observação do sentinela —
  // com userinfo habilitado, o ID token só carrega o `sub`).
  const userinfo = await oidc.userinfo(tokenSet);
  const email = String(userinfo.email ?? idClaims.email ?? "");

  const response = NextResponse.redirect(new URL(pkce.returnTo, origin));

  const sessionCookie = await createStudioSessionCookie({
    sub: idClaims.sub,
    email,
  });
  response.cookies.set(sessionCookie.name, sessionCookie.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionCookie.maxAge,
  });
  response.cookies.delete(PKCE_COOKIE);

  return response;
}
