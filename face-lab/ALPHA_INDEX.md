# 📚 Índice de Documentação Alpha — Face Lab "Gato-Veloz-v0.1"

**Versão**: `Gato-Veloz-v0.1`  
**Status**: 🔴 ALPHA  
**Data**: Julho 2026  
**URL**: https://face.bit-lab.tech

---

## 🎯 Por Onde Começar?

### 👤 Você é um **Alpha Tester**?

```
1. Leia [ALPHA_TESTERS.md](ALPHA_TESTERS.md) — guia de uso passo-a-passo
2. Explore o app em https://face.bit-lab.tech
3. Use [ALPHA_QA_CHECKLIST.md](ALPHA_QA_CHECKLIST.md) para validar tudo
4. Reporte bugs: GitHub Issues com label [face-lab-alpha]
```

---

### 🛠️ Você é um **Desenvolvedor**?

```
1. Leia [ALPHA_RELEASE.md](ALPHA_RELEASE.md) — o que está congelado
2. Veja [FEATURES.md](FEATURES.md) — detalhes técnicos de cada feature
3. Estude [ALPHA_FLOW.md](ALPHA_FLOW.md) — diagramas de fluxo
4. Execute: README.md → setup local
5. Próxima fase? Leia "Backlog" em FEATURES.md
```

---

### 🚀 Você é um **Product Lead**?

```
1. Leia [ALPHA_RELEASE.md](ALPHA_RELEASE.md) — escopo, gaps, critérios
2. Decisões futuras: "Backlog" em FEATURES.md
3. Roadmap: próximos passos em ALPHA_RELEASE.md
```

---

## 📖 Documentação Completa

### Fase Alpha (Este Release)

| Documento | Público | Descrição |
|---|---|---|
| **[ALPHA_RELEASE.md](ALPHA_RELEASE.md)** | ✅ Todos | Escopo congelado, gaps conhecidos, critérios de aceitação, checklist |
| **[ALPHA_TESTERS.md](ALPHA_TESTERS.md)** | ✅ Testers | Guia passo-a-passo de uso + troubleshooting + checklist de teste |
| **[ALPHA_FLOW.md](ALPHA_FLOW.md)** | ✅ Todos | Diagramas visuais: fluxos de enrollment, scan, galeria, admin |
| **[ALPHA_QA_CHECKLIST.md](ALPHA_QA_CHECKLIST.md)** | ✅ QA/Testers | Checklist detalhado de validação por feature |
| **[ALPHA_INDEX.md](ALPHA_INDEX.md)** | ✅ Todos | Este arquivo — índice e navegação |

---

### Especificações Técnicas

| Documento | Público | Descrição |
|---|---|---|
| **[README.md](README.md)** | ✅ Devs | Setup, deploy, arquitetura, componentes |
| **[FEATURES.md](FEATURES.md)** | ✅ Todos | Mapa vivo de features implementadas + gaps + backlog |
| **[db/schema.sql](db/schema.sql)** | ✅ Devs | Modelo de dados completo (comentado) |
| **[PWA.md](apps/web/PWA.md)** | ✅ Todos | Configuração PWA, como instalar, offline |

---

### Orientações de Políticas

| Documento | Público | Descrição |
|---|---|---|
| **[Privacy.md](apps/web/src/pages/Privacy.md)** | ✅ Usuários | Política de privacidade (dados guardados, embeddings, etc) |
| **[Terms.md](apps/web/src/pages/Terms.md)** | ✅ Usuários | Termos de uso |

---

## 🎯 Matriz de Navegação (por Perfil)

### Alpha Tester

**Primeira vez?**
- 🔴 [ALPHA_TESTERS.md](ALPHA_TESTERS.md) — começar aqui
- 🟡 [ALPHA_FLOW.md](ALPHA_FLOW.md) — entender fluxo
- 🟢 [ALPHA_QA_CHECKLIST.md](ALPHA_QA_CHECKLIST.md) — validar

**Depois de usar:**
- ❌ Encontrou bug? → GitHub Issues (`[face-lab-alpha]`)
- 💬 Tem sugestão? → Comente em issue ou email

**Dúvidas técnicas?**
- 🔍 [FEATURES.md](FEATURES.md) — detalhes de como funciona
- 🔍 [ALPHA_RELEASE.md](ALPHA_RELEASE.md) — gaps + limitações

---

### Desenvolvedor

**Entendendo o projeto:**
1. [README.md](README.md) — stack, componentes, setup
2. [FEATURES.md](FEATURES.md) — o que existe
3. [ALPHA_FLOW.md](ALPHA_FLOW.md) — fluxos de dados

**Desenvolvimento:**
- Setup local: README.md → "Desenvolvimento local"
- Banco de dados: db/schema.sql
- Frontend: apps/web/ → React components
- Backend: apps/api/ → Fastify routes
- Worker: workers/face/ → Python + InsightFace

**Próxima fase (backlog):**
- [FEATURES.md](FEATURES.md) → seção "Backlog"
- [ALPHA_RELEASE.md](ALPHA_RELEASE.md) → "Próximos Passos"

---

### Gerente/Lead

**Status do Alpha:**
- [ALPHA_RELEASE.md](ALPHA_RELEASE.md) — tudo que importa

**Critérios de sucesso:**
- [ALPHA_RELEASE.md](ALPHA_RELEASE.md) → "Critérios de Aceitação"
- [ALPHA_QA_CHECKLIST.md](ALPHA_QA_CHECKLIST.md) → template de validação

**Roadmap futuro:**
- [ALPHA_RELEASE.md](ALPHA_RELEASE.md) → "Próximos Passos"
- [FEATURES.md](FEATURES.md) → "Backlog"

**Decisões:**
- Gaps conhecidos: [ALPHA_RELEASE.md](ALPHA_RELEASE.md) → ⚠️ Gaps
- Trade-offs: [FEATURES.md](FEATURES.md) → contexto por feature

---

## 🔗 Links Rápidos

### Aplicação

- **App Principal**: https://face.bit-lab.tech
- **SSO/Login**: https://auth.bit-lab.tech
- **Documentação**: [GitHub face-lab](https://github.com/bit-lab/bit-lab-agents/tree/main/face-lab)

### Feedback & Issues

- **Bugs**: [GitHub Issues](https://github.com/bit-lab/bit-lab-agents/issues?q=label%3Aface-lab-alpha)
- **Email**: rodrigo@bit-lab.tech
- **Slack**: #face-lab (bit-lab workspace)

### Recursos Externos

- **Google Drive**: https://drive.google.com (pra criar test folders)
- **Lighthouse**: DevTools → Lighthouse (validar PWA)
- **Rollbar**: Dashboard de erros (dev/ops)

---

## 📋 Listas de Verificação Rápidas

### Antes de Testar

```
- [ ] Você tem acesso a https://face.bit-lab.tech
- [ ] Você tem conta no bit-lab-auth
- [ ] Você tem Google Drive com ≥1 pasta de teste (se producer)
- [ ] Browser atualizado (Chrome 120+, Safari 17+, Firefox 120+)
- [ ] Console do navegador aberto (F12) pra debug
```

### Depois de Testar

```
- [ ] Completei [ALPHA_QA_CHECKLIST.md](ALPHA_QA_CHECKLIST.md)?
- [ ] Reportei todos os bugs encontrados (GitHub)?
- [ ] Deixei feedback sobre UX/features?
- [ ] Assinei o checklist de QA?
```

### Antes de Expandir Alpha

```
- [ ] Todos os bloqueadores foram fixados?
- [ ] % de passes aceitável (ex: >95%)?
- [ ] Sign-off do produto?
- [ ] Documentação atualizada?
```

---

## 🐾 Versão & Release Notes

**Versão**: `Gato-Veloz-v0.1`  
🐱 *Gato* = Ágil, curioso, independente — assim é Face Lab  
⚡ *Veloz* = Reconhecimento rápido, instant matching  
**v0.1** = Fase inicial do alpha

**O que mudou desde (pre-alpha)**:
- ✅ PWA adicionado (installável em desktop e mobile)
- ✅ Documentação completa de alpha (testers, flows, checklists)
- ✅ Features congeladas e publicadas
- ✅ Gaps conhecidos documentados

**Próxima versão (pós-alpha)**:
- 🔜 Notificações de match novo
- 🔜 Re-scan automático
- 🔜 Índice vetorial para escalabilidade
- 🔜 Cobertura de testes

Ver [ALPHA_RELEASE.md](ALPHA_RELEASE.md) → "Próximos Passos" para roadmap completo.

---

## ❓ FAQ Rápido

**P: Por onde eu começo?**  
R: Leia [ALPHA_TESTERS.md](ALPHA_TESTERS.md) se é tester, ou README.md se é dev.

**P: Como reporto um bug?**  
R: [GitHub Issues](https://github.com/bit-lab/bit-lab-agents/issues) com label `[face-lab-alpha]`.

**P: O app está pronto pra produção?**  
R: Não, é alpha. Gaps conhecidos: [ALPHA_RELEASE.md](ALPHA_RELEASE.md) → ⚠️ Gaps.

**P: Quando sai beta/produção?**  
R: Veja [ALPHA_RELEASE.md](ALPHA_RELEASE.md) → "Próximos Passos".

**P: Minhas fotos são armazenadas no Face Lab?**  
R: Não, ficam no seu Google Drive. Face Lab guarda miniaturas, crops, embeddings.

**P: Qual é o modelo de IA usado?**  
R: InsightFace buffalo_l (SCRFD + ArcFace 512-d).

**P: Posso usar a API diretamente?**  
R: Ainda não é pública; use via web app.

---

## 🎓 Glossário

| Termo | Significado |
|---|---|
| **Embedding** | Representação numérica do rosto (vetor 512-d ArcFace) |
| **Distância** | Similaridade entre dois rostos (0=idêntico, 1=diferente; <0.4=match) |
| **Centroide** | Posição média de um cluster de rostos similares |
| **Pessoa** | Cluster de rostos automáticamente agrupados (mesma pessoa em múltiplas fotos) |
| **Match** | Correspondência entre rosto detectado e enrollment do usuário |
| **Enrollment** | Rosto cadastrado pelo usuário (webcam ou upload) |
| **Crop** | Recorte da foto focado no rosto (bbox + margem) |
| **Thumb** | Miniatura da foto (1024px) |
| **Rate Limit** | Limite de requisições/min (ex: 30 fotos/min por producer) |
| **PWA** | Progressive Web App (installável, offline) |

---

## 📞 Contato

- **Bugs/Issues**: [GitHub](https://github.com/bit-lab/bit-lab-agents/issues)
- **Email**: rodrigo@bit-lab.tech
- **Slack**: bit-lab workspace, #face-lab channel

---

## 🎉 Pronto?

```
👉 Alpha Tester → Vai para [ALPHA_TESTERS.md](ALPHA_TESTERS.md)
👉 Desenvolvedor → Vai para [README.md](README.md)
👉 Gerente → Vai para [ALPHA_RELEASE.md](ALPHA_RELEASE.md)
```

**Bem-vindo ao Face Lab! 🐱⚡**

---

*Última atualização: Julho 2026*  
*Versão: Gato-Veloz-v0.1*  
*Mantido por: @rodrigo*
