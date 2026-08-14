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

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  fields?: { type: string; text: string }[];
}

/** POST cru pro Incoming Webhook — nunca lança, loga e retorna false em
 * qualquer falha (URL ausente, timeout, resposta não-ok). Compartilhado
 * pelas duas notificações (Open CDJ, contato do studio) — mesmo webhook por
 * enquanto (SLACK_OPENCDJ_WEBHOOK_URL), só o texto/blocks mudam. */
async function postToSlack(text: string, blocks: SlackBlock[]): Promise<boolean> {
  const url = process.env.SLACK_OPENCDJ_WEBHOOK_URL;
  if (!url) {
    console.error("SLACK_OPENCDJ_WEBHOOK_URL não definido — mensagem não enviada");
    return false;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, blocks }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`Slack respondeu ${res.status} ao postar mensagem`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Falha ao postar mensagem no Slack", err);
    return false;
  }
}

interface OpencdjSubmission {
  name: string;
  instagram: string;
  whatsapp: string;
  genre: string;
  about?: string;
}

export async function notifyOpencdjSubmission(input: OpencdjSubmission): Promise<boolean> {
  const text = ":loud_sound: *Nova inscrição Open CDJ*";
  return postToSlack(text, [
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
  ]);
}

interface StudioContactSubmission {
  name: string;
  contact: string;
  message: string;
}

/** Notifica mensagens do form de contato público da landing do studio —
 * mesmo webhook do Open CDJ por enquanto (ver postToSlack), texto/emoji
 * diferentes só pra distinguir no canal. */
export async function notifyStudioContact(input: StudioContactSubmission): Promise<boolean> {
  const text = ":speech_balloon: *Novo contato — bit-lab studio*";
  return postToSlack(text, [
    { type: "section", text: { type: "mrkdwn", text } },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Nome*\n${input.name}` },
        { type: "mrkdwn", text: `*Contato*\n${input.contact}` },
      ],
    },
    { type: "section", text: { type: "mrkdwn", text: `*Mensagem*\n${input.message}` } },
  ]);
}
