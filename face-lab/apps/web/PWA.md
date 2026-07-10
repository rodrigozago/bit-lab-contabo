# Face Lab - Progressive Web App (PWA)

Este aplicativo foi configurado como um Progressive Web App completo, permitindo:

- ✅ Instalação como app nativo (desktop e mobile)
- ✅ Funcionamento offline com cache inteligente
- ✅ Ícones e logos customizados "FACE LAB"
- ✅ Suporte para iOS e Android

## Arquivos da Configuração PWA

### Assets (public/)
- **favicon.svg** - Ícone do navegador (192x192)
- **logo-192.svg** - Logo para tela inicial (192x192)
- **logo-512.svg** - Logo para splash screen (512x512)
- **manifest.json** - Manifesto da aplicação PWA
- **service-worker.js** - Service Worker para cache e offline

### Arquivo Principal
- **index.html** - HTML com meta tags PWA e registro do Service Worker

## Como Instalar a Aplicação

### No Desktop (Chrome/Edge)
1. Abra a aplicação em http://localhost:5173
2. Clique no ícone de instalação na barra de endereço
3. Siga os passos de instalação

### No Mobile
1. **Android**: Abra no Chrome → Menu (⋮) → "Instalar aplicativo"
2. **iOS**: Abra no Safari → Compartilhar → "Adicionar à Tela Inicial"

## Desenvolvimento

### Rodar localmente
```bash
cd apps/web
pnpm dev
```

### Testar PWA (Chrome DevTools)
1. Abra DevTools (F12)
2. Vá para: Application → Manifest
3. Verifique se o manifesto está carregado corretamente
4. Vá para: Application → Service Workers
5. Verifique se o Service Worker está registrado e ativo

### Build para produção
```bash
cd apps/web
pnpm build
```

## Gerar PNGs dos Logos (Opcional)

Se precisar de versões PNG dos logos SVG:

```bash
# Instalar dependência
pnpm add -D sharp

# Rodar script
node scripts/generate-pngs.js
```

## Funcionalidades do Service Worker

- **Cache-first**: Arquivos estáticos são servidos do cache quando disponível
- **Network-fallback**: Se a rede falhar, retorna resposta offline
- **Auto-update**: Novas versões do app são instaladas automaticamente
- **API bypass**: Requisições para `/api/*` não são cacheadas

## Meta Tags Importantes

```html
<!-- Torna o app installável -->
<link rel="manifest" href="/manifest.json" />

<!-- Customiza a cor da barra de status -->
<meta name="theme-color" content="#3b82f6" />

<!-- Suporte iOS -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Face Lab" />
```

## Personalizações

Para customizar o PWA, edite:

1. **Cores**: `manifest.json` e `public/logo-*.svg`
2. **Nome**: `manifest.json` → `name` e `short_name`
3. **Descrição**: `index.html` → `<meta name="description">`
4. **Comportamento offline**: `public/service-worker.js`

## Verificação de Produção

Use o Lighthouse no Chrome DevTools:
1. DevTools → Lighthouse
2. Modo: Mobile
3. Categorias: selecione "PWA"
4. Gere relatório

## Referências

- [Web.dev - PWA Checklist](https://web.dev/pwa-checklist/)
- [MDN - Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Google - Installable Web Apps](https://web.dev/install-criteria/)
