# 🚀 Quick Fix — Security Improvements

**Esforço**: ~1 dia por item  
**Dificuldade**: Baixa-Média  
**Prioridade**: 🔴 Implementar antes de produção

---

## 1️⃣ Adicionar Helmet (Security Headers) — 30 min

### Instalação
```bash
cd apps/api
npm install @fastify/helmet
```

### Código (src/index.ts)
```typescript
import helmet from "@fastify/helmet";

async function main(): Promise<void> {
  const app = Fastify({ logger: true, trustProxy: true });
  
  // ✅ ANTES DE OUTRAS REGISTRAÇÕES
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https://drive.google.com"],
        connectSrc: ["'self'", "https://auth.bit-lab.tech"],
        frameSrc: ["'self'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xContentTypeOptions: true,
    xDNSPrefetchControl: true,
    xFrameOptions: "DENY",
    xXssProtection: true,
  });

  // Resto do código...
  await app.register(cookie, { secret: config.sessionSecret });
  // ...
}
```

### Teste
```bash
curl -I https://localhost:3001/health
# Verificar headers:
# Strict-Transport-Security: max-age=31536000
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
```

---

## 2️⃣ Adicionar CORS Restrictivo — 30 min

### Instalação
```bash
npm install @fastify/cors
```

### Código (src/index.ts)
```typescript
import cors from "@fastify/cors";

// ✅ APÓS HELMET, ANTES DE OUTRAS ROTAS
await app.register(cors, {
  origin: config.isProd 
    ? ["https://face.bit-lab.tech", "https://auth.bit-lab.tech"]
    : ["http://localhost:5173", "http://localhost:3004"],
  credentials: true,  // Envia cookies
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
```

### Teste
```bash
# Teste CORS bloqueado
curl -H "Origin: https://evil.com" https://face.bit-lab.tech/api/me
# Deve retornar: ❌ Sem header Access-Control-Allow-Origin

# Teste CORS permitido
curl -H "Origin: https://face.bit-lab.tech" https://face.bit-lab.tech/api/me
# Deve retornar: ✅ Access-Control-Allow-Origin: https://face.bit-lab.tech
```

---

## 3️⃣ Validação com Zod — 2-3 horas por endpoint

### Instalação
```bash
npm install zod
```

### Exemplo: routes/albums.ts
```typescript
import { z } from "zod";

// ✅ Definir schema antes da rota
const CreateAlbumSchema = z.object({
  name: z.string()
    .min(1, "Nome obrigatório")
    .max(255, "Nome muito longo"),
  driveFolderId: z.string()
    .regex(/^[a-zA-Z0-9_-]{20,}$/, "ID do folder inválido"),
});

const AlbumIdSchema = z.object({
  id: z.string().uuid("ID inválido"),
});

// ✅ Usar nos handlers
app.post("/api/albums", async (req, reply) => {
  const user = await requireProducer(req, reply);
  if (!user) return;

  // Validar entrada
  const parsed = CreateAlbumSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({
      ok: false,
      error: "Validação falhou",
      details: parsed.error.flatten(),
    });
  }

  const { name, driveFolderId } = parsed.data;
  // Agora é seguro usar parsed.data — tipos garantidos
});

app.get("/api/albums/:id", async (req, reply) => {
  const user = await requireUser(req, reply);
  if (!user) return;

  const parsed = AlbumIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return reply.status(400).send({ ok: false, error: "ID inválido" });
  }

  const { id } = parsed.data;
  // ...
});
```

### Aplicar em TODOS endpoints:
- [ ] `POST /api/albums` ✅
- [ ] `PATCH /api/albums/:id`
- [ ] `DELETE /api/albums/:id`
- [ ] `POST /api/albums/:id/scan`
- [ ] `POST /api/enrollment`
- [ ] `POST /api/my/matches/:id/confirm`
- [ ] `POST /api/my/matches/:id/reject`
- [ ] `GET /api/admin/users`
- [ ] `PATCH /api/admin/users/:id/role`

---

## 4️⃣ Reduzir Rate Limits — 15 min

### Código (config.ts)
```typescript
export const config = {
  // ... resto

  rate: {
    producerPerMin: 5,      // ⬇️ De 30 pra 5
    globalPerMin: 20,       // ⬇️ De 60 pra 20
    enrollPerMin: 3,        // ⬇️ De 10 pra 3 (webcam é pesado)
    // Novos:
    mediaDownloadPerMin: 10, // Novo limite: downloads
    adminActionPerMin: 5,    // Novo: proteção admin
  },
};
```

### Teste
```bash
# Script que faz 10 requests rápido
for i in {1..10}; do
  curl -s -w "%{http_code}" https://face.bit-lab.tech/api/me
  echo ""
done

# Esperado: 200 200 200 200 200 429 429 429 429 429
# (5 ok, 5 rate limited)
```

---

## 5️⃣ Adicionar Audit Logging — 3-4 horas

### Instalação
```bash
npm install winston
```

### Criar logger (src/services/auditLog.ts)
```typescript
import winston from "winston";
import { config } from "../config.js";

const logger = winston.createLogger({
  level: config.isProd ? "info" : "debug",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),
    new winston.transports.File({
      filename: "logs/audit.log",
      format: winston.format.json(),
    }),
  ],
});

export function logLogin(userId: string, email: string, isAdmin: boolean) {
  logger.info("user.login", {
    userId,
    email,
    isAdmin,
    timestamp: new Date().toISOString(),
  });
}

export function logLoginFailure(email: string, reason: string) {
  logger.warn("user.login_failure", {
    email,
    reason,
    timestamp: new Date().toISOString(),
  });
}

export function logRateLimitViolation(userId: string, endpoint: string) {
  logger.warn("security.rate_limit", {
    userId,
    endpoint,
    timestamp: new Date().toISOString(),
  });
}

export function logAdminAction(
  adminId: string,
  action: string,
  targetId?: string
) {
  logger.info("admin.action", {
    adminId,
    action,
    targetId,
    timestamp: new Date().toISOString(),
  });
}
```

### Usar nos routes
```typescript
// routes/auth.ts
import { logLogin, logLoginFailure } from "../services/auditLog.js";

app.get("/api/auth/callback", async (req, reply) => {
  const params = req.query as Record<string, string>;

  if (params["error"]) {
    logLoginFailure("unknown", params["error"]);  // ✅ Log falha
    return reply.redirect(`/?authError=...`);
  }

  const { sub, email, isAdmin, returnTo } = await finishAuth(params);
  logLogin(userId, email, isAdmin);  // ✅ Log sucesso

  // ... resto
});
```

---

## 6️⃣ Secrets Management com GitHub — 30 min

### Setup (repositório privado)

**1. GitHub Secrets**:
```
Repo → Settings → Secrets and variables → Actions
Adicionar:
  - SESSION_SECRET
  - OIDC_CLIENT_SECRET
  - GOOGLE_CLIENT_SECRET
  - GOOGLE_TOKEN_ENC_KEY
  - ROLLBAR_SERVER_TOKEN
```

**2. .github/workflows/deploy.yml**
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Face Lab
        env:
          SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
          OIDC_CLIENT_SECRET: ${{ secrets.OIDC_CLIENT_SECRET }}
          GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}
          GOOGLE_TOKEN_ENC_KEY: ${{ secrets.GOOGLE_TOKEN_ENC_KEY }}
        run: |
          npm install
          npm run build
      
      - name: Deploy to Production
        run: |
          # Seu comando de deploy
          # Secrets são injetados automaticamente
```

**3. .gitignore** (certifique-se que está correto)
```
.env
.env.local
.env.*.local
.env.production.local
```

---

## 7️⃣ Melhorar Validação de Redirect — 30 min

### Código (src/routes/auth.ts)
```typescript
function safeReturnTo(raw: unknown): string {
  try {
    const s = typeof raw === "string" ? raw : "";
    
    // ✅ Aceita apenas paths absolutos
    if (!s.startsWith("/") || s.startsWith("//")) return "/";
    
    // ✅ Rejeita null bytes e encoding perigoso
    if (s.includes("\0") || s.includes("%00")) return "/";
    
    // ✅ Limita tamanho (previne DoS)
    if (s.length > 512) return "/";
    
    // ✅ Whitelist de paths seguros
    const safePaths = ["/", "/me", "/enroll", "/producer", "/resources"];
    const pathOnly = s.split("?")[0];  // Remove query string
    
    if (!safePaths.some(p => pathOnly.startsWith(p))) {
      return "/";
    }
    
    return s;
  } catch {
    return "/";
  }
}
```

---

## 8️⃣ Adicionar Security Headers em Media Routes — 15 min

### Código (routes/media.ts)
```typescript
async function sendWebp(reply: FastifyReply, absPath: string) {
  try {
    await stat(absPath);
  } catch {
    return reply.status(404).send({ ok: false, error: "arquivo não existe" });
  }

  return reply
    .type("image/webp")
    .header("Cache-Control", "private, max-age=3600, must-revalidate")
    .header("Vary", "Cookie, Authorization")  // ✅ Novo
    .header("X-Content-Type-Options", "nosniff")  // ✅ Novo
    .header("X-Frame-Options", "DENY")  // ✅ Novo
    .header("X-XSS-Protection", "1; mode=block")  // ✅ Novo
    .send(createReadStream(absPath));
}
```

---

## 📋 Checklist de Implementação

### Semana 1
- [ ] **Dia 1**: Helmet + CORS
  - [ ] npm install @fastify/helmet @fastify/cors
  - [ ] Atualizar index.ts
  - [ ] Testar com curl
  - [ ] Fazer PR, code review

- [ ] **Dia 2-3**: Zod Validation
  - [ ] npm install zod
  - [ ] Adicionar schemas em auth.ts
  - [ ] Adicionar schemas em albums.ts
  - [ ] Adicionar schemas em enrollment.ts
  - [ ] Testar com invalid inputs

- [ ] **Dia 4**: Rate Limiting Redux
  - [ ] Reduzir limites em config.ts
  - [ ] Testar com script
  - [ ] Adicionar logs

- [ ] **Dia 5**: Secrets Management
  - [ ] Configurar GitHub Secrets
  - [ ] Atualizar .github/workflows/deploy.yml
  - [ ] Testar em CI

### Semana 2
- [ ] **Dia 1-2**: Audit Logging
  - [ ] Instalar Winston
  - [ ] Criar auditLog.ts
  - [ ] Adicionar logs em auth routes
  - [ ] Adicionar logs em admin routes

- [ ] **Dia 3-4**: Testes de Segurança
  - [ ] npm install --save-dev jest supertest
  - [ ] Teste de CORS bypass
  - [ ] Teste de rate limiting
  - [ ] Teste de authorization

- [ ] **Dia 5**: Code Review + Fixes
  - [ ] Revisar com OWASP checklist
  - [ ] Aplicar fixes pendentes
  - [ ] Preparar PR final

---

## 🧪 Testes de Validação

### CORS
```bash
# Deve FALHAR (403)
curl -H "Origin: https://evil.com" \
     -H "Access-Control-Request-Method: GET" \
     https://face.bit-lab.tech/api/me

# Deve PASSAR (200)
curl -H "Origin: https://face.bit-lab.tech" \
     https://face.bit-lab.tech/api/me
```

### Validação
```bash
# Deve FALHAR (400)
curl -X POST https://face.bit-lab.tech/api/albums \
     -H "Content-Type: application/json" \
     -d '{"name": "", "driveFolderId": "123"}'

# Deve PASSAR (201)
curl -X POST https://face.bit-lab.tech/api/albums \
     -H "Content-Type: application/json" \
     -d '{"name": "My Album", "driveFolderId": "1ABC123XYZ456..."}'
```

### Rate Limiting
```bash
#!/bin/bash
# Fazer 10 requisições rápido, esperando 429 depois de 5
for i in {1..10}; do
  echo "Request $i:"
  curl -s -w "HTTP %{http_code}\n" https://face.bit-lab.tech/api/me
done
```

### Security Headers
```bash
curl -I https://face.bit-lab.tech/health
# Deve conter:
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Content-Security-Policy: ...
```

---

## 📚 Referências

- [Fastify Security](https://www.fastify.io/docs/latest/Guides/Security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Zod Validation](https://zod.dev/)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

## ✅ Success Criteria

Depois de implementar tudo:

- ✅ Todos endpoints têm validação Zod
- ✅ Rate limits reduzidos e testados
- ✅ Security headers presentes (curl -I)
- ✅ CORS bloqueando origins não-autorizadas
- ✅ Secrets em GitHub, não em .env
- ✅ Audit logs registrando ações importantes
- ✅ Testes de segurança passando
- ✅ OWASP Top 10 checklist completo

---

**Tempo Total**: 2-3 semanas (parte-time)  
**Resultado**: Sistema pronto para produção segura

🚀
