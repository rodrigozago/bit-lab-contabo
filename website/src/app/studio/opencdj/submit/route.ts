import { NextResponse, type NextRequest } from "next/server";
import { notifyOpencdjSubmission } from "@/lib/slack";

const MAX_LEN = 200;

function isValidField(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_LEN;
}

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

  const { name, contact, genre } = body;
  if (!isValidField(name) || !isValidField(contact) || !isValidField(genre)) {
    return NextResponse.json({ ok: false, error: "campos obrigatórios ausentes" }, { status: 400 });
  }

  const notified = await notifyOpencdjSubmission({
    name: name.trim(),
    contact: contact.trim(),
    genre: genre.trim(),
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
