import { NextResponse, type NextRequest } from "next/server";
import { notifyOpencdjSubmission } from "@/lib/slack";
import { getStudioSession } from "@/lib/studio-session";

const MAX_LEN = 200;
const MAX_ABOUT_LEN = 2000;

function isValidField(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_LEN;
}

// "about" é opcional — só valida o tamanho, quando vier.
function isValidAbout(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.length <= MAX_ABOUT_LEN);
}

export async function POST(request: NextRequest) {
  // A página já barra sem sessão (OpencdjLoginGate), mas isso não impede um
  // POST direto — o form agora é exclusivo pra quem logou, checa de novo aqui.
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

  // honeypot preenchido = bot; finge sucesso sem notificar ninguém
  if (typeof body.website_url === "string" && body.website_url.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  // nome/instagram/whatsapp vêm da sessão, não do body — o form manda esses
  // campos desabilitados, mas nada impede alguém de forjar o POST direto;
  // só `genre` é dado do usuário de verdade aqui.
  if (!session.name || !session.instagram || !session.whatsapp) {
    return NextResponse.json({ ok: false, error: "perfil incompleto" }, { status: 400 });
  }

  const { genre, about } = body;
  if (!isValidField(genre)) {
    return NextResponse.json({ ok: false, error: "preenche o gênero/vertente" }, { status: 400 });
  }
  if (!isValidAbout(about)) {
    return NextResponse.json({ ok: false, error: "texto muito longo" }, { status: 400 });
  }

  const notified = await notifyOpencdjSubmission({
    name: session.name,
    instagram: session.instagram,
    whatsapp: session.whatsapp,
    genre: genre.trim(),
    about: about?.trim() || undefined,
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
