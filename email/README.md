# bit-lab-email

Microserviço interno de envio de e-mail transacional, atrás do Resend.
Não tem banco, não tem UI — é só um wrapper HTTP fino em volta do SDK do
Resend, pra qualquer outro serviço do monorepo poder mandar e-mail sem
precisar da própria integração com o provedor.

Hoje o único consumidor é o `auth/` (convite, esqueci-senha, verificação de
e-mail). Qualquer serviço novo que precise mandar e-mail deve chamar este
serviço, não integrar com o Resend direto.

## Por que um serviço separado (e não uma lib dentro de cada app)

Os serviços deste monorepo **não compartilham rede Docker** entre si — cada
`docker-compose.yml` tem sua própria rede isolada. A comunicação entre eles
acontece via HTTPS público através do nginx da VPS (mesmo padrão do fluxo
OIDC do `auth`). Este serviço segue a mesma convenção: fica em
`mail.bit-lab.tech`, protegido por uma chave compartilhada no header
`X-Internal-Key` (não é público de verdade — só não usa `auth_request` do
nginx porque quem chama não é uma sessão de usuário, é outro serviço).

## API

`POST /send` — header `X-Internal-Key: <INTERNAL_KEY>` obrigatório.

```json
{
  "template": "invite" | "password-reset" | "email-verification",
  "to": "usuario@exemplo.com",
  "data": { "url": "https://...", "expiresAt": "2026-08-24T00:00:00Z" }
}
```

`GET /health` — sem auth, pra monitoramento.

## Rodando localmente

```bash
cp .env.example .env   # preencha RESEND_API_KEY, EMAIL_FROM, INTERNAL_KEY
npm install
npm run dev
```

Em dev, sem domínio verificado no Resend, use o remetente sandbox
`onboarding@resend.dev` em `EMAIL_FROM` — funciona sem configurar DNS.

## Deploy na VPS

```bash
./scripts/install.sh
```

Builda a imagem, sobe o container (porta `127.0.0.1:4006`, só loopback) e
instala o bloco `mail.bit-lab.tech` de `nginx/bit-lab.tech.conf` — reusa o
certificado wildcard `*.bit-lab.tech` já existente, não precisa de
certificado novo.

## Adicionar um consumidor novo

1. Gerar (ou reusar) a `INTERNAL_KEY` e colocar no `.env` do serviço novo.
2. Chamar `POST https://mail.bit-lab.tech/send` com o header
   `X-Internal-Key`.
3. Se precisar de um template novo, adicionar em `src/templates/` e
   registrar em `src/routes/send.js` (`TEMPLATES`).
