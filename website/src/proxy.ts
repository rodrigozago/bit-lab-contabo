import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Um único container (porta 3008) serve dois hostnames — bit-lab.tech/www
 * (site principal) e studio.bit-lab.tech (nova área "studio"). O nginx só
 * encaminha pro mesmo processo; a separação por domínio acontece aqui via
 * rewrite, mantendo a URL visível igual e roteando internamente pra
 * app/studio/*. Ver AGENTS.md: Next 16 renomeou middleware.ts -> proxy.ts. */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("studio.")) {
    const url = request.nextUrl.clone();
    url.pathname = `/studio${url.pathname}`;
    return NextResponse.rewrite(url);
  }
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
