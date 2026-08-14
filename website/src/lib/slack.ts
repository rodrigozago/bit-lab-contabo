import "server-only";

/** Notifica inscrições do Open CDJ via Slack Incoming Webhook — inspirado no
 * `notify_slack()` de ponto-studio/workers/embroidery/worker.py (POST cru,
 * sem SDK), mas AQUI o sucesso do envio importa: essa notificação é o único
 * lugar onde a inscrição fica registrada (não há banco/CMS), então falha
 * aqui precisa virar erro pro usuário — quem se inscreve tem que saber que
 * precisa tentar de novo ou chamar direto, não pode achar que deu certo
 * quando na real ninguém do bit-lab vai saber que ele se inscreveu.
 * Reaproveita o mesmo webhook/canal do ponto-studio — valor copiado pro
 * .env do website/, ver SLACK_OPENCDJ_WEBHOOK_URL. */

interface OpencdjSubmission {
  name: string;
  instagram: string;
  whatsapp: string;
  genre: string;
  about?: string;
}

export async function notifyOpencdjSubmission(input: OpencdjSubmission): Promise<boolean> {
  const url = process.env.SLACK_OPENCDJ_WEBHOOK_URL;
  if (!url) {
    console.error("SLACK_OPENCDJ_WEBHOOK_URL não definido — inscrição não notificada");
    return false;
  }

  const text = ":loud_sound: *Nova inscrição Open CDJ*";
  const payload = {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Nome*\n${input.name}` },
          { type: "mrkdwn", text: `*Instagram*\n${input.instagram}` },
          { type: "mrkdwn", text: `*WhatsApp*\n${input.whatsapp}` },
          { type: "mrkdwn", text: `*Gênero*\n${input.genre}` },
        ],
      },
      ...(input.about
        ? [{ type: "section", text: { type: "mrkdwn", text: `*Sobre*\n${input.about}` } }]
        : []),
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`Slack respondeu ${res.status} ao notificar inscrição do Open CDJ`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Falha ao postar inscrição do Open CDJ no Slack", err);
    return false;
  }
}
