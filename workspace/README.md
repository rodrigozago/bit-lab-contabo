# Workspace Infra — Nextcloud + Modoboa

Stack completo de workspace self-hosted (Google Workspace alternativa) com:
- **Nextcloud**: Storage, Docs, Calendar, Contacts (cloud.bit-lab.tech)
- **Modoboa**: Email + Webmail (mail.bit-lab.tech)

## Prerequisitos

- VPS Linux (Ubuntu 20.04+) — testado em Contabo
- Docker + Docker Compose instalados
- Nginx rodando (reverse proxy)
- SSL certificate pra `bit-lab.tech` (certbot)
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

### 2.1 SSL Certificate

Se você ainda não tem cert pra `bit-lab.tech`:

```bash
sudo certbot certonly --standalone \
  -d cloud.bit-lab.tech \
  -d mail.bit-lab.tech
```

Se você já tem wildcard `*.bit-lab.tech`, reutiliza.

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

```bash
# Verificar se DNS está ok
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
