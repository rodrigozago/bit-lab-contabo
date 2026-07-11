# 🔐 Análise de Segurança — Face Lab & Auth

**Data**: Julho 10, 2026  
**Versão**: Gato-Veloz-v0.1  
**Status**: 🟡 Alpha (várias áreas precisam melhorias)

---

## Resumo Executivo

**Posição de Segurança**: Básica funcional, mas com gaps críticos para produção.

| Área | Status | Prioridade |
|---|---|---|
| Autenticação | ✅ Bom | — |
| Autorização | ✅ Bom | — |
| Criptografia | ✅ Bom | — |
| Controle de Acesso (Mídia) | ✅ Bom | — |
| CORS & Headers | 🟡 Incompleto | 🔴 Alta |
| Rate Limiting | 🟡 Básico | 🟡 Média |
| Input Validation | 🟡 Parcial | 🔴 Alta |
| Secrets Management | 🟡 Manual | 🟡 Média |
| Logging & Monitoring | 🟡 Básico | 🟡 Média |
| Testes de Segurança | ❌ Nenhum | 🔴 Alta |
| Dependencies | 🟡 Desatualizado | 🟡 Média |

---

## ✅ Pontos Fortes

### 1. Autenticação OIDC Robusta
```typescript
// ✅ BOAS PRÁTICAS
- PKCE (Proof Key Code Exchange) implementado
- Tokens não são expostos ao frontend
- BFF (Backend for Frontend) pattern corretamente implementado
- Session TTL de 7 dias (razoável)
```

**Status**: ✅ Produção-ready

---

### 2. Criptografia de Credenciais Google
```typescript
// ✅ AES-256-GCM com IV aleatório
encrypt(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  // ... iv || tag || ciphertext
}
```

**Status**: ✅ Produção-ready

---

### 3. Session Management
```typescript
// ✅ HOST-ONLY cookies (não interfere com auth.bit-lab.tech)
reply.setCookie(COOKIE_NAME, token, {
  httpOnly: true,           // ✅ não acessível via JS
  secure: config.isProd,    // ✅ HTTPS only em prod
  sameSite: "lax",          // ✅ proteção CSRF
  path: "/",
  maxAge: config.sessionTtlSeconds,
});
```

**Status**: ✅ Produção-ready

---

### 4. Controle de Acesso a Mídia
```sql
-- ✅ Verificação rigorosa de permissões
SELECT f.crop_path FROM faces f
WHERE f.id = $1 AND (
  $3 OR a.owner_id = $2 OR EXISTS (
    SELECT 1 FROM matches WHERE face_id = f.id AND user_id = $2
  )
)
```

**Status**: ✅ Produção-ready

---

### 5. Guards de Papéis (Role-based Access Control)
```typescript
// ✅ Hierarquia clara: guest ⊂ producer ⊂ admin
export async function requireProducer(req, reply) {
  const user = await requireUser(req, reply);
  if (user.role !== "producer" && user.role !== "admin") {
    return reply.status(403).send({ error: "requer papel producer" });
  }
  return user;
}
```

**Status**: ✅ Produção-ready

---

## 🟡 Áreas que Precisam Melhorias

### 1. CORS & Security Headers — 🔴 CRÍTICO

**Problema**:
```typescript
// apps/api/src/index.ts
const app = Fastify({ logger: true, trustProxy: true });
// ❌ Sem @fastify/cors
// ❌ Sem security headers (HSTS, CSP, X-Frame-Options, etc)
```

**Risco**: 
- ❌ CORS mal configurado → CSRF possível
- ❌ Sem HSTS → Downgrade attack em prod
- ❌ Sem CSP → XSS pode executar scripts
- ❌ Sem X-Frame-Options → Clickjacking

**Recomendação**:
```bash
npm install @fastify/cors @fastify/helmet
```

```typescript
// src/index.ts
await app.register(require("@fastify/helmet"));
await app.register(require("@fastify/cors"), {
  origin: config.isProd ? ["https://face.bit-lab.tech"] : true,
  credentials: true,
});
```

---

### 2. Input Validation — 🔴 CRÍTICO

**Problema**: Falha em validar entrada de usuário em vários endpoints

**Exemplos**:
```typescript
// ❌ routes/albums.ts
app.post("/api/albums", async (req, reply) => {
  const { name, driveFolderId } = req.body; // Sem validação!
  // Risco: nome pode ter 10k caracteres, SQL injection via folder ID
});

// ❌ routes/auth.ts — returnTo validation existe, mas é frágil
function safeReturnTo(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
  // OK para paths locais, mas falta validação de XSS
}
```

**Recomendação**:
```bash
npm install zod
```

```typescript
import { z } from "zod";

const CreateAlbumSchema = z.object({
  name: z.string().min(1).max(255),
  driveFolderId: z.string().regex(/^[a-zA-Z0-9_-]{20,}$/, "ID inválido"),
});

app.post("/api/albums", async (req, reply) => {
  const { name, driveFolderId } = CreateAlbumSchema.parse(req.body);
  // ...
});
```

---

### 3. Rate Limiting — 🟡 BÁSICO

**Problema**: Rate limit por IP/usuário implementado, mas muito permissivo e sem alertas

```typescript
// config.ts
rate: {
  producerPerMin: 30,    // 30 fotos/min = 1.8k/hora (muito!)
  globalPerMin: 60,      // 60 global
  enrollPerMin: 10,      // 10 enrollments/min (ok)
}
```

**Risco**:
- 30 fotos/min por usuário → DDoS possível
- Sem alertas quando limite é atingido → abuse invisível
- Sem separação por endpoint (scan vs enrollment)

**Recomendação**:
```typescript
// Reduzir para valores mais seguros
rate: {
  producerPerMin: 5,      // 5 fotos/min (300/hora)
  globalPerMin: 20,       // 20 global
  enrollPerMin: 3,        // 3 enrollments/min
  mediaDownloadPerMin: 10, // Novo: limite de download
}
```

---

### 4. Secrets Management — 🟡 MANUAL

**Problema**: Segredos em `.env` (inseguro em Git, VCS expõe histórico)

```bash
# .env.example (público)
SESSION_SECRET=troque_por_uma_string_aleatoria_longa
GOOGLE_TOKEN_ENC_KEY=                          # Vazio!
OIDC_CLIENT_SECRET=troque_por_um_secret_aleatorio_longo
```

**Risco**:
- ❌ Se `.env` for commitado acidentalmente, a chave fica em Git forever
- ❌ Sem rotação automática
- ❌ Sem auditoria de acesso
- ❌ Sem versionamento

**Recomendação**:

Option 1 (Simples): GitHub Secrets + Vault simples
```bash
# .gitignore
.env
.env.local
.env.*.local

# CI/CD: export vars do GitHub Secrets
export SESSION_SECRET=${{ secrets.SESSION_SECRET }}
```

Option 2 (Melhor): Vault + CI/CD
```bash
# Use HashiCorp Vault em produção
# docker-compose.prod.yml: vault service
```

---

### 5. Validation de URL Redirect — 🟡 INCOMPLETO

**Problema**: `safeReturnTo` valida apenas localhost, mas não escape de XSS

```typescript
// ❌ Vulnerável a parameter pollution
// ?returnTo=/&returnTo=javascript:alert('xss')

function safeReturnTo(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}
```

**Recomendação**:
```typescript
import { URL } from "url";

function safeReturnTo(raw: unknown): string {
  try {
    const s = typeof raw === "string" ? raw : "";
    // Aceita apenas paths absolutos, não URLs completas
    if (!s.startsWith("/") || s.startsWith("//")) return "/";
    
    // Valida que é um path válido (sem null bytes, etc)
    if (s.includes("\0") || s.includes("%00")) return "/";
    
    return s;
  } catch {
    return "/";
  }
}
```

---

### 6. Logging & Monitoring — 🟡 BÁSICO

**Problema**: Logging mínimo, sem estrutura para audit trail

```typescript
// ✅ Log existe:
req.log.info({ sub, email, isAdmin }, "login OIDC concluído");

// ❌ Mas falta:
// - Audit trail de alterações (quem deletou o quê, quando)
// - Login failures (tentativas rejeitadas)
// - Access to sensitive data
// - Admin actions
// - Rate limit violations
// - Google token refresh failures
```

**Recomendação**:
```typescript
// Adicionar logs estruturados
// Login success
app.log.info({ userId, email, timestamp: new Date() }, "user.login_success");

// Login failure
app.log.warn({ email, reason: "SSO error", error: err.message }, "user.login_failed");

// Admin action
app.log.info({ adminId, action: "promoteToProducer", targetUserId }, "admin.action");

// Suspicious activity
app.log.error({ userId, reason: "rate_limit_exceeded" }, "security.rate_limit_violation");
```

---

### 7. Dependencies Desatualizadas — 🟡 MÉDIO

**Problema**: Dependências podem ter CVEs

```json
// package.json
"fastify": "^4.28.1",        // Pode estar desatualizado
"pg": "^8.12.0",             // Pode ter CVEs
"openid-client": "^5.7.0",   // Importante: manter atualizado
```

**Recomendação**:
```bash
npm audit
npm update (com cuidado)
# Adicionar ao CI: npm audit --production (falha em CVEs críticas)
```

---

### 8. SQL Injection — 🟡 RISCO BAIXO (mas presente)

**Status**: Bom — usando parameterized queries

```typescript
// ✅ SEGURO: placeholders $1, $2, etc
await pool.query(
  "SELECT * FROM users WHERE id = $1",
  [userId]
);

// ❌ INSEGURO (não encontrado, mas possível se não cuidar):
// query(`SELECT * FROM albums WHERE owner = ${ownerId}`)
```

**Recomendação**: Manter padrão de parameterized queries sempre.

---

### 9. CSRF Protection — 🟡 IMPLEMENTADO MAS FRÁGIL

**Status**: Cookies SameSite = "lax" protege POST, mas GET+redirect vulnerável

```typescript
// ✅ Cookies têm SameSite=lax
// ❌ Mas redirect em GET (returnTo) pode ser explorado

// Ataque: https://evil.com?redirect=to /admin, clica em link em email
// Face Lab faz redirect silencioso pro admin, bypassa navegação
```

**Recomendação**: Validar estado OIDC contra sessão anterior

---

### 10. Cache Control — 🟡 INCOMPLETO

**Problema**: Mídia privada tem `Cache-Control: private`, mas sem Vary

```typescript
// sendWebp()
return reply
  .type("image/webp")
  .header("Cache-Control", "private, max-age=3600")
  .send(createReadStream(absPath));

// ❌ Falta: Vary: Authorization, Cookie
// Se a CDN ignorar "private", dois usuários podem compartilhar cache
```

**Recomendação**:
```typescript
.header("Cache-Control", "private, max-age=3600, must-revalidate")
.header("Vary", "Cookie")
.header("X-Content-Type-Options", "nosniff")
.header("X-Frame-Options", "DENY")
```

---

## 🔴 Problemas Críticos — Para Produção

### 1. Sem HTTPS em Dev (mesmo que marcado `secure: isProd`)

**Problema**: 
```typescript
reply.setCookie(COOKIE_NAME, token, {
  secure: config.isProd,  // false em dev → cookie inseguro
});
```

**Risco**: Cookie pode ser interceptado em dev se não cuidar

**Fix**: Usar mkcert para HTTPS local
```bash
mkcert localhost
# Gera localhost.pem + localhost-key.pem
```

---

### 2. Sem Rate Limit em Endpoints Críticos

**Faltam rate limits em**:
- `/api/me/accept-terms` (gate importante)
- `/api/albums/:id/scan` (recurso pesado)
- `/api/enrollment` (upload de webcam)
- `/api/media/*` (downloads)

**Recomendação**: Aplicar rate limit em TODAS rotas autenticadas

---

### 3. Sem Testes de Segurança

**Problema**: Nenhum teste automatizado para:
- Authorization bypass
- SQL injection
- XSS
- CSRF
- Rate limiting
- Privilege escalation

**Recomendação**:
```bash
npm install --save-dev jest supertest
# Adicionar testes de segurança no CI
```

---

## 📋 Checklist de Segurança — O que Fazer

### Imediato (Antes de Produção)

- [ ] **Adicionar @fastify/helmet** (HSTS, CSP, X-Frame-Options)
- [ ] **Adicionar @fastify/cors** com origin restrictivo
- [ ] **Implementar schema validation** com Zod em TODOS endpoints
- [ ] **Reduzir rate limits** (producer: 5, global: 20)
- [ ] **Adicionar logging estruturado** (audit trail, login failures)
- [ ] **Validar redirects** (returnTo, Google callback)
- [ ] **Adicionar security headers** (Vary, X-Content-Type-Options, etc)
- [ ] **npm audit** e resolver CVEs críticas
- [ ] **Secrets management** (GitHub Secrets ou Vault)
- [ ] **HTTPS em produção** (Let's Encrypt + Nginx)

### Curto Prazo (Primeira Semana)

- [ ] **Testes de segurança** (unit tests + integration tests)
- [ ] **Code review focado em segurança** (OWASP Top 10)
- [ ] **Penetration testing** (contratar especialista)
- [ ] **Política de senhas** (mínimo de 12 chars, rotação)
- [ ] **Backup & disaster recovery** (testar)
- [ ] **GDPR compliance** (consentimento, direito ao esquecimento)

### Médio Prazo (Primeira Mês)

- [ ] **WAF (Web Application Firewall)** no Nginx/Cloudflare
- [ ] **DDoS protection** (Cloudflare, AWS Shield)
- [ ] **Bug bounty program** (HackerOne, Bugcrowd)
- [ ] **Security incident response plan**
- [ ] **Audit de terceiros** (security firm)
- [ ] **MFA (Multi-factor authentication)**

---

## 🔒 Recomendações por Sistema

### Face Lab API

**Prioridade Alta**:
1. ✅ Adicionar Helmet (headers de segurança)
2. ✅ Validação com Zod (todos endpoints)
3. ✅ Rate limiting mais restritivo
4. ✅ Audit logging
5. ✅ Testes de segurança

**Implementação Estimada**: ~1 semana

---

### Auth (bit-lab-auth)

**Presumindo que existe separado**:

**Verificar**:
- [ ] Token expiration (OIDC tokens)
- [ ] Logout em todos os clients quando logout em auth
- [ ] Session fixation protection
- [ ] Password complexity enforcement
- [ ] Brute force protection
- [ ] Account lockout após N tentativas
- [ ] IP whitelist para admin endpoints
- [ ] Logs de auditoria de todas ações admin

---

## 📊 Matriz de Risco

| Vulnerabilidade | Probabilidade | Impacto | Risco | Mitigation |
|---|---|---|---|---|
| CORS bypass | Média | Alto | 🔴 Alto | Helmet + CORS package |
| Input validation bypass | Média | Alto | 🔴 Alto | Zod validation |
| Rate limiting bypass | Alta | Médio | 🔴 Alto | Reduzir limites |
| CSRF (GET redirect) | Baixa | Médio | 🟡 Médio | Validar returnTo rigorosamente |
| Cache poisoning | Baixa | Alto | 🟡 Médio | Adicionar Vary headers |
| SQL injection | Muito Baixa | Crítico | 🟡 Médio | Manter parameterized queries |
| Secrets exposure | Média | Crítico | 🔴 Alto | Usar Vault/GitHub Secrets |
| Privilege escalation | Baixa | Crítico | 🟡 Médio | Testes de RBAC |

---

## 🎯 Plan de Ação — Próximas 2 Semanas

### Semana 1

**Dia 1-2: Segurança Headers**
```bash
npm install @fastify/helmet @fastify/cors
# Implementar em index.ts
# Teste: curl -I https://face.bit-lab.tech → verificar headers
```

**Dia 3-4: Input Validation**
```bash
npm install zod
# Adicionar schemas em auth.ts, albums.ts, enrollment.ts
# Testes: tentar injetar valores inválidos
```

**Dia 5: Rate Limiting**
```typescript
// Reduzir valores em config.ts
// Teste: script que faz 100 requests, verifica 429
```

### Semana 2

**Dia 1-2: Logging & Monitoring**
```typescript
// Estruturar logs com Winston ou Pino
// Adicionar campos: userId, email, timestamp, action
```

**Dia 3: Testes de Segurança**
```bash
npm install --save-dev jest supertest
# Testes de authorization, rate limiting, etc
```

**Dia 4-5: Code Review + Fixes**
```
Revisar todos endpoints com checklist OWASP
Aplicar patches conforme encontrar
```

---

## 📚 Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Fastify Security](https://www.fastify.io/docs/latest/Guides/Security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Auth0 — Securing APIs](https://auth0.com/docs/get-started/apis)
- [Zod Schema Validation](https://zod.dev/)

---

## ✅ Conclusão

Face Lab é **funcional mas não pronto para produção** em segurança.

**Pontos Fortes**: Autenticação, criptografia, controle de acesso  
**Gaps Críticos**: Headers, validação, rate limiting, testes

**Esforço para produção**: ~2-3 semanas com time experiente em segurança

**Recomendação**: Não fazer deploy em produção sem implementar pelo menos itens da "Prioridade Alta"

---

*Análise realizada: Julho 10, 2026*  
*Versão: Gato-Veloz-v0.1*  
*Próxima revisão: Após implementar recommendations*
