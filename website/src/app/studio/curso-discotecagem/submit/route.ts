import { NextResponse, type NextRequest } from "next/server";
import { notifyCourseSignup } from "@/lib/slack";
import { getStudioSession } from "@/lib/studio-session";

const MAX_LEN = 200;
const MAX_MOTIVATION_LEN = 2000;

function isValidField(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_LEN;
}

function isValidMotivation(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.length <= MAX_MOTIVATION_LEN);
}

/** Só esse arquivo existe em app/studio/curso-discotecagem/ — sem page.tsx,
 * então não conflita com o catch-all (marketing)/[...slug] servindo
 * /studio/curso-discotecagem normalmente (mesmo padrão de
 * app/studio/contact/submit/route.ts coexistindo com o form embutido na
 * home). Sessão exigida (diferente do /contact/submit, público) — nome/
 * instagram/whatsapp sempre vêm da sessão, nunca confiados no body. */
export async function POST(request: NextRequest) {
  const session = await getStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "corpo inválido" }, { status: 400 });
  }

  if (typeof body.website_url === "string" && body.website_url.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  if (!session.name || !session.instagram || !session.whatsapp) {
    return NextResponse.json({ ok: false, error: "perfil incompleto" }, { status: 400 });
  }

  const { experience, motivation } = body;
  if (!isValidField(experience)) {
    return NextResponse.json({ ok: false, error: "preenche o nível de experiência" }, { status: 400 });
  }
  if (!isValidMotivation(motivation)) {
    return NextResponse.json({ ok: false, error: "texto muito longo" }, { status: 400 });
  }

  const notified = await notifyCourseSignup({
    name: session.name,
    instagram: session.instagram,
    whatsapp: session.whatsapp,
    experience: experience.trim(),
    motivation: motivation?.trim() || undefined,
  });

  if (!notified) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "não conseguimos registrar sua inscrição agora. tente de novo em alguns minutos, ou manda um email direto pra rz@bit-lab.tech",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
