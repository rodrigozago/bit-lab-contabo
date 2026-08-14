import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/studio-session";
import { PUBLIC_URL } from "@/lib/studio-oidc";

function safeReturnTo(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

/** Limpa só a sessão local do studio (studio_session) — não é logout SSO
 * completo (bl_session em auth.bit-lab.tech continua valendo, então o
 * próximo /auth/login passa direto sem pedir senha de novo). Existe
 * principalmente pra forçar um studio_session novo depois de editar o
 * perfil (nome/instagram/whatsapp) em apps.bit-lab.tech/profile — a sessão
 * antiga guarda uma cópia desses dados de quando logou, editar o perfil
 * depois não atualiza essa cópia sozinha. */
export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const response = NextResponse.redirect(new URL(returnTo, PUBLIC_URL));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
