import { NextResponse, type NextRequest } from "next/server";
import { notifyStudioContact } from "@/lib/slack";

const MAX_LEN = 200;
const MAX_MESSAGE_LEN = 2000;

function isValidField(value: unknown, maxLen: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLen;
}

/** POST /contact/submit — form público da landing do studio, SEM sessão
 * exigida (diferente de /opencdj/submit, que é gated). Mesmo padrão de
 * honeypot + notificação via Slack (notifyStudioContact). */
export async function POST(request: NextRequest) {
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

  const { name, contact, message } = body;
  if (
    !isValidField(name, MAX_LEN) ||
    !isValidField(contact, MAX_LEN) ||
    !isValidField(message, MAX_MESSAGE_LEN)
  ) {
    return NextResponse.json({ ok: false, error: "preenche todos os campos" }, { status: 400 });
  }

  const notified = await notifyStudioContact({
    name: name.trim(),
    contact: contact.trim(),
    message: message.trim(),
  });

  if (!notified) {
    return NextResponse.json(
      { ok: false, error: "não conseguimos enviar agora. tenta de novo em alguns minutos." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
