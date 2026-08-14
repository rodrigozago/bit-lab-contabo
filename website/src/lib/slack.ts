import "server-only";

/** Notifica inscrições do Open CDJ via Slack Incoming Webhook — porta de
 * `notify_slack()` em ponto-studio/workers/embroidery/worker.py. Mesmo
 * padrão: POST cru (sem SDK), no-op silencioso sem a env var, nunca lança
 * (Slack fora do ar não pode quebrar a resposta pro usuário que preencheu
 * o formulário). Reaproveita o mesmo webhook/canal do ponto-studio — valor
 * copiado pro .env do website/, ver SLACK_OPENCDJ_WEBHOOK_URL. */

interface OpencdjSubmission {
  name: string;
  contact: string;
  genre: string;
}

export async function notifyOpencdjSubmission(input: OpencdjSubmission): Promise<void> {
  const url = process.env.SLACK_OPENCDJ_WEBHOOK_URL;
  if (!url) return;

  const text = ":loud_sound: *Nova inscrição Open CDJ*";
  const payload = {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Nome*\n${input.name}` },
          { type: "mrkdwn", text: `*Contato*\n${input.contact}` },
          { type: "mrkdwn", text: `*Gênero*\n${input.genre}` },
        ],
      },
    ],
  };

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("Falha ao postar inscrição do Open CDJ no Slack", err);
  }
}
