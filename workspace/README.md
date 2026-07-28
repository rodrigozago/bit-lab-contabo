# Workspace Infra — Nextcloud + Modoboa

Stack completo de workspace self-hosted (Google Workspace alternativa) com:
- **Nextcloud**: Storage, Docs, Calendar, Contacts (cloud.bit-lab.tech)
- **Modoboa**: Email + Webmail (mail.bit-lab.tech)

## Prerequisitos

- VPS Linux (Ubuntu 20.04+) — testado em Contabo
- Docker + Docker Compose instalados
- Nginx rodando (reverse proxy)
- Origin Certificate wildcard da Cloudflare em `/etc/ssl/cloudflare/bit-lab.tech.{pem,key}` (já usado pelos outros apps de `*.bit-lab.tech`)
- Certificado Let's Encrypt específico pra `mail.bit-lab.tech` (ver seção 2.1 — motivo do DNS-only)
- Portas abertas: 25, 143, 587, 993 (email)

## 1. Setup inicial

### 1.1 Clonar e entrar na pasta

```bash
cd ~/bit-lab-agents/workspace
```

### 1.2 Criar `.env` com as senhas

```bash
cp .env.example .env
# Editar .env com senhas fortes
nano .env
```

Mude:
- `POSTGRES_PASSWORD` → senha forte pro PostgreSQL
- `MODOBOA_SECRET_KEY` → chave secreta aleatória

```bash
# Gerar chaves aleatórias (opcional)
openssl rand -base64 32
```

### 1.3 Subir containers

```bash
docker-compose up -d
```

Isso inicia:
- **PostgreSQL** (localhost:5432)
- **Nextcloud** (localhost:8080)
- **Modoboa** (localhost:8081)

Verificar se está tudo ok:
```bash
docker-compose logs -f
```

## 2. Nginx (reverse proxy)

### 2.1 SSL Certificate — 2 certificados diferentes, de propósito

`cloud.bit-lab.tech` e `mail.bit-lab.tech` NÃO usam o mesmo tipo de
certificado, porque um fica atrás do proxy da Cloudflare e o outro não pode
ficar (e-mail exige DNS-only).

**`cloud.bit-lab.tech`** — reutiliza o Origin Certificate wildcard que você
já tem em `/etc/ssl/cloudflare/bit-lab.tech.{pem,key}` (mesmo cert que
`ponto.bit-lab.tech`/`bordado.digital`/etc. usam). Nenhuma ação necessária
aqui além de manter o registro DNS `cloud` como **Proxied** (nuvem laranja)
na Cloudflare — pode deixar o wildcard cobrir, não precisa de registro
específico.

**`mail.bit-lab.tech`** — precisa de certificado público de verdade (Let's
Encrypt), porque este host tem que ficar **DNS only** (nuvem cinza) na
Cloudflare pra e-mail funcionar (ver seção 4.2 — SMTP/IMAP não passam pelo
proxy dela de jeito nenhum). Sem o proxy no meio, um Origin Certificate
apareceria como "não confiável" pro navegador de quem acessa o webmail.

Passo a passo:
1. Na Cloudflare, crie um registro A específico pra `mail` (nome `mail`,
   aponta pro IP do servidor) e deixe explicitamente **DNS only** — isso
   sobrepõe o wildcard só pra esse host exato; `cloud`, `studio`, `auth` etc.
   continuam Proxied normalmente, sem nenhum efeito colateral.
2. Espere a propagação (`dig mail.bit-lab.tech` deve devolver o IP real do
   servidor, não um IP da Cloudflare).
3. Gere o certificado (HTTP-01, funciona porque o host já está DNS-only):
   ```bash
   sudo certbot certonly --standalone -d mail.bit-lab.tech
   ```
   Fica em `/etc/letsencrypt/live/mail.bit-lab.tech/{fullchain,privkey}.pem`
   — já é o caminho que `nginx.conf` espera.
4. Renovação automática — o certbot já instala um timer/cron; confirme com
   `sudo certbot renew --dry-run`.

### 2.2 Ativar config Nginx

```bash
sudo cp nginx.conf /etc/nginx/sites-available/workspace
sudo ln -s /etc/nginx/sites-available/workspace /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Verificar:
```bash
sudo systemctl status nginx
```

## 3. Nextcloud (cloud.bit-lab.tech)

### 3.1 Acessar e fazer setup inicial

Abrir navegador: https://cloud.bit-lab.tech

1. **Dados de admin**: criar usuário admin (ex: `admin` / senha forte)
2. **Database**: já está configurado (PostgreSQL)
3. **Finish setup**

### 3.2 Instalar Mail App (opcional)

No painel de Nextcloud:
- Vai em **Apps** (canto superior direito)
- Busca **Mail**
- **Install**

Depois você pode conectar ao Modoboa pra ter email integrado no Nextcloud.

### 3.3 Configurar trusted domains

Se acessar por múltiplos domínios (ex: `cloud.bordado.digital`), adicionar em:
```bash
# Dentro do container
docker exec -it nextcloud bash
nano /var/www/html/config/config.php

# Procura por 'trusted_domains' e adiciona:
'trusted_domains' =>
array (
  0 => 'localhost',
  1 => 'cloud.bit-lab.tech',
  2 => 'cloud.bordado.digital',  // se precisar
),
```

Depois restart:
```bash
docker-compose restart nextcloud
```

## 4. Modoboa (mail.bit-lab.tech)

### 4.1 Acessar admin

https://mail.bit-lab.tech/admin (usuário default: `admin` / `password`)

**MUDE A SENHA IMEDIATAMENTE**

### 4.2 Adicionar domínios

1. Vai em **Domains** → **Add domain**
2. Adiciona `bordado.digital`
3. Aponta DNS (Modoboa te mostra os records):
   - **MX**: `mail.bit-lab.tech`
   - **SPF**: `v=spf1 mx -all`
   - **DMARC**: `v=DMARC1; p=none` (começa fraco, depois muda pra `quarantine`/`reject`)

O MX aponta pro hostname `mail.bit-lab.tech` — confirme que o **registro A**
desse hostname (não o MX em si, DNS não deixa proxied em MX de qualquer
jeito) está **DNS only** na Cloudflare (ver seção 2.1). Se estiver Proxied,
a entrega de e-mail simplesmente não chega — servidores remotos tentam
conectar na porta 25 do IP da Cloudflare, que não aceita SMTP.

```bash
# Verificar se DNS está ok — deve devolver o IP REAL do servidor, não um IP da Cloudflare
dig +short mail.bit-lab.tech
dig MX bordado.digital
dig TXT bordado.digital
```

### 4.3 Criar usuários

1. Domains → seleciona domínio → **Mailboxes** → **Add mailbox**
2. Cria email (ex: `contato@bordado.digital`)
3. Define senha

### 4.4 Acessar webmail

https://mail.bit-lab.tech (login com email + senha)

## 5. Testar email

### 5.1 Receber email de fora

Enviar um email pra `contato@bordado.digital` de uma conta real (Gmail, Outlook, etc).

Se não chegar:
```bash
# Verificar logs do Postfix (MTA do Modoboa)
docker exec modoboa postfix logs
# Ou
docker logs modoboa | grep -i mail
```

### 5.2 Enviar email

Login no webmail e enviar um email pra si mesmo.

Se der erro de autenticação, verificar em Modoboa admin que usuário existe e senha está certa.

## 6. Integrar Nextcloud Mail (opcional)

Se instalou o Mail App:

1. Nextcloud → **Settings** (canto superior direito) → **Mail**
2. **Add mail account**
3. Credenciais:
   - Email: `usuario@bordado.digital`
   - Password: senha
   - imap: `mail.bit-lab.tech` porta 993 (IMAPS)
   - smtp: `mail.bit-lab.tech` porta 587 (STARTTLS)

## 7. Backup (importante!)

### 7.1 PostgreSQL

```bash
docker exec postgres pg_dump -U nextcloud nextcloud > ~/nextcloud_backup_$(date +%Y%m%d).sql
```

### 7.2 Dados (Nextcloud + Modoboa)

```bash
docker run --rm -v workspace_nextcloud_data:/data -v ~/backup:/backup \
  alpine tar czf /backup/nextcloud_data_$(date +%Y%m%d).tar.gz -C /data .

docker run --rm -v workspace_modoboa_data:/data -v ~/backup:/backup \
  alpine tar czf /backup/modoboa_data_$(date +%Y%m%d).tar.gz -C /data .
```

### 7.3 Automatizar (cron)

```bash
# Criar script backup.sh
cat > ~/backup_workspace.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=~/backups
mkdir -p $BACKUP_DIR

# PostgreSQL
docker exec postgres pg_dump -U nextcloud nextcloud | gzip > $BACKUP_DIR/nextcloud_backup_$(date +%Y%m%d).sql.gz

# Nextcloud data
docker run --rm -v workspace_nextcloud_data:/data -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/nextcloud_$(date +%Y%m%d).tar.gz -C /data .

# Modoboa data
docker run --rm -v workspace_modoboa_data:/data -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/modoboa_$(date +%Y%m%d).tar.gz -C /data .

# Manter só os últimos 7 dias
find $BACKUP_DIR -type f -mtime +7 -delete
EOF

chmod +x ~/backup_workspace.sh

# Adicionar ao crontab (rodar todo dia às 2am)
(crontab -l 2>/dev/null; echo "0 2 * * * ~/backup_workspace.sh") | crontab -
```

## 8. Troubleshooting

### 8.1 Email não chega

```bash
# Verificar logs do Modoboa
docker logs modoboa

# Testar SMTP manualmente
telnet mail.bit-lab.tech 25
```

### 8.2 Nextcloud lento

- Aumentar RAM do container em `docker-compose.yml`
- Verificar `docker stats`

### 8.3 Certificado SSL expirou

O de `cloud.bit-lab.tech` é o Origin Certificate da Cloudflare (validade
longa, ~15 anos — não renova via certbot, é reemitido manualmente no painel
da Cloudflare se precisar). Só o de `mail.bit-lab.tech` (Let's Encrypt, 90
dias) precisa de renovação automática:

```bash
sudo certbot renew
sudo systemctl restart nginx
```

### 8.4 Resetar Modoboa (nuclear option)

```bash
docker-compose down
docker volume rm workspace_modoboa_data
docker-compose up -d modoboa
# Setup do zero no admin
```

## 9. URLs de produção

Quando tudo está rodando:

| Serviço | URL | Login |
|---------|-----|-------|
| Nextcloud | https://cloud.bit-lab.tech | admin |
| Modoboa webmail | https://mail.bit-lab.tech | usuario@dominio |
| Modoboa admin | https://mail.bit-lab.tech/admin | admin |

## 10. Monitoramento contínuo

Acompanhar logs:
```bash
docker-compose logs -f nextcloud
docker-compose logs -f modoboa
docker-compose logs -f postgres
```

Ou tudo junto:
```bash
docker-compose logs -f
```

## Referências

- [Nextcloud docs](https://docs.nextcloud.com)
- [Modoboa docs](https://modoboa.readthedocs.io)
- [Mail setup checklist](https://www.mail-tester.com)
