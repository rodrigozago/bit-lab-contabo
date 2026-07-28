# Migração: Ponto Studio → Bordado Digital

Guia de deploy pra rodar em produção depois do rename de `ponto-studio` →
`bordado-digital` (client OIDC, slug no banco, domínio). Sem esses passos na
ordem certa, o login SSO quebra pros usuários já logados.

## O que mudou no código

| Antes | Depois |
|---|---|
| `client_id: 'ponto-studio'` (OIDC) | `client_id: 'bordado-digital'` |
| slug `'ponto-studio'` na tabela `apps` | slug `'bordado-digital'` |
| env `PONTO_STUDIO_OIDC_SECRET` (auth + ponto-studio) | env `BORDADO_DIGITAL_OIDC_SECRET` |
| `OIDC_CLIENT_ID=ponto-studio` (ponto-studio) | `OIDC_CLIENT_ID=bordado-digital` |
| `PUBLIC_URL=https://ponto.bit-lab.tech` | `PUBLIC_URL=https://bordado.digital` |
| `redirect_uris: ['https://ponto.bit-lab.tech/api/auth/callback']` | `['https://bordado.digital/api/auth/callback']` |
| nginx: bloco `ponto.bit-lab.tech` em `nginx/bit-lab.tech.conf` | bloco próprio em `nginx/bordado.digital.conf` |

**Não mudou:** a pasta `ponto-studio/` continua com esse nome, os pacotes
`@ponto-studio/*` também — só identificadores que afetam o SSO e o domínio
público. Ver comentário no início desses arquivos se precisar confirmar.

## Ordem de deploy (importante)

A migração do banco (passo 2) precisa rodar **antes** do `auth` subir com o
código novo — senão o `bootstrap()` do `auth` cria um app NOVO com slug
`bordado-digital` (via `INSERT ... ON CONFLICT DO UPDATE`) em vez de
renomear o existente, e todo `app_access` concedido antes fica preso no app
antigo (órfão).

### 1. Backup do Postgres do `auth`

```bash
docker exec -t <container_postgres_auth> pg_dump -U bitlab_auth bitlab_auth > backup_auth_$(date +%Y%m%d).sql
```

### 2. Renomear o slug do app no banco (SQL direto, sem delete+insert)

```sql
-- Preserva o id do app → todo app_access/signup_token_apps continua valendo,
-- ninguém perde acesso.
UPDATE apps SET slug = 'bordado-digital', name = 'Bordado Digital'
WHERE slug = 'ponto-studio';
```

Rodar contra o Postgres do `auth`:
```bash
docker exec -i <container_postgres_auth> psql -U bitlab_auth -d bitlab_auth < migracao.sql
```

Confirme antes de seguir:
```sql
SELECT id, slug, name FROM apps WHERE slug = 'bordado-digital';
-- deve retornar 1 linha, com o MESMO id de antes (se você anotou)
```

### 3. Atualizar `.env` dos dois serviços

**`auth/.env`** — renomeia a variável (mesmo valor de secret, só o nome muda):
```bash
# antes: PONTO_STUDIO_OIDC_SECRET=xxxxx
BORDADO_DIGITAL_OIDC_SECRET=xxxxx   # mesmo valor de antes
```

**`ponto-studio/.env`** — idem:
```bash
# antes: PONTO_STUDIO_OIDC_SECRET=xxxxx
BORDADO_DIGITAL_OIDC_SECRET=xxxxx   # mesmo valor de antes
```

(`docker-compose.yml` dos dois serviços já lê essas envs pelos nomes novos —
só falta o `.env` real na VPS ter a variável com o nome novo.)

### 4. DNS + certificado do domínio novo

- `bordado.digital` (A/AAAA) apontando pro mesmo IP do servidor.
- Certificado em `/etc/ssl/cloudflare/bordado.digital.{pem,key}` (Cloudflare
  Origin Certificate, mesmo processo já usado pra `bit-lab.tech`).

Sem isso, o passo 6 (`nginx -t`) falha ou o HTTPS não funciona.

### 5. `git pull` + rebuild dos dois serviços

```bash
cd bit-lab-agents
git pull origin main

cd auth
sudo ./scripts/install.sh    # docker compose build+up, nginx (bit-lab.tech.conf)

cd ../ponto-studio
sudo ./scripts/install.sh    # docker compose build+up, nginx (bordado.digital.conf)
```

`install.sh` do `ponto-studio` agora copia `nginx/bordado.digital.conf`
(antes copiava o bloco `ponto.bit-lab.tech` de dentro de `bit-lab.tech.conf`
— esse bloco foi removido de lá).

### 6. Verificação pós-deploy

```bash
# app registrado no auth com o client novo
curl -s https://auth.bit-lab.tech/.well-known/openid-configuration | grep issuer

# nginx serve o domínio novo
curl -I https://bordado.digital

# login completo: abrir no navegador e conferir que:
#   1. https://bordado.digital redireciona pro login se deslogado
#   2. login funciona e volta pro app (/api/auth/callback completa sem erro)
#   3. usuários que já tinham acesso ANTES da migração continuam entrando
#      (prova que o UPDATE do passo 2 preservou o app_access)
```

### 7. (Opcional, depois de confirmar que está tudo ok) Descomissionar `ponto.bit-lab.tech`

O domínio velho não serve mais o app (bloco removido do nginx). Se quiser,
remova o registro DNS de `ponto.bit-lab.tech` — não é urgente, só fica
"morto" (sem nginx block, sem SSL válido pro Origin Certificate se não
incluído).

## Rollback

Se algo der errado depois do passo 2 (banco) e antes do passo 5 completar
nos dois serviços:

```sql
UPDATE apps SET slug = 'ponto-studio', name = 'Ponto Studio'
WHERE slug = 'bordado-digital';
```

E reverta o `.env`/deploy pro commit anterior (`git log` pra achar o commit
antes do rename). O `nginx/bit-lab.tech.conf` antigo (com o bloco
`ponto.bit-lab.tech`) está no histórico do git se precisar restaurar rápido:
```bash
git show <commit-antes-do-rename>:nginx/bit-lab.tech.conf > nginx/bit-lab.tech.conf
```
