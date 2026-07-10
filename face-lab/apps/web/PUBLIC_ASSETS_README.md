# PDFs como Assets na Aplicação Web

## 📁 Estrutura

Os PDFs foram adicionados como assets da aplicação web:

```
apps/web/
├── public/
│   └── docs/
│       ├── Face_Lab_Producer_Guide.pdf
│       └── Face_Lab_Guest_Guide.pdf
└── src/
    ├── pages/
    │   └── Resources.tsx          ← Nova página de documentação
    └── components/
        └── AppLayout.tsx          ← Link adicionado no footer
```

---

## 🌐 Acessibilidade

### URLs Públicas

Os PDFs são servidos como arquivos estáticos:

```
https://face.bit-lab.tech/docs/Face_Lab_Producer_Guide.pdf
https://face.bit-lab.tech/docs/Face_Lab_Guest_Guide.pdf
```

### Página de Recursos

Nova página criada: `/resources`

```
https://face.bit-lab.tech/resources
```

**Características**:
- ✅ Acessível sem login
- ✅ Cards com descrição de cada guia
- ✅ Botões de download
- ✅ Links para outra documentação
- ✅ Informações de contato/suporte

---

## 🔗 Links de Navegação

### Na Página de Landing (não logado)
```
Footer: Documentação | Termos de Uso | Política de Privacidade
         ↓
    /resources
```

### Na Aplicação (logado)
```
Sidebar/Menu Footer: Documentação | Termos | Privacidade
                     ↓
                /resources
```

---

## 📄 Página Resources (novo)

**Arquivo**: `src/pages/Resources.tsx`

**Funcionalidades**:
- ✅ Header com branding Face Lab
- ✅ Grid de 2 guias (Producer + Guest)
- ✅ Cards com ícones, descrição e botão de download
- ✅ Informações adicionais (documentação técnica)
- ✅ Contato/suporte
- ✅ Versão do release (Gato-Veloz-v0.1)

**Design**:
- Cores consistentes (azul #3b82f6)
- Responsivo (mobile, tablet, desktop)
- Cards interativos com hover
- Botões de download funcionais

---

## 📥 Como Baixar

### Opção 1: Via Página /resources
1. Acesse https://face.bit-lab.tech/resources
2. Encontre o guia (Producer ou Guest)
3. Clique "Baixar PDF"
4. PDF é baixado automaticamente

### Opção 2: URL Direta
```
https://face.bit-lab.tech/docs/Face_Lab_Producer_Guide.pdf
https://face.bit-lab.tech/docs/Face_Lab_Guest_Guide.pdf
```

### Opção 3: Links no Footer
- Footer da landing page
- Footer do menu (quando logado)
- Ambos contêm link "Documentação" → /resources

---

## 🔧 Configuração

### Arquivos Modificados

1. **src/App.tsx**
   - ✅ Import: `import Resources from "./pages/Resources";`
   - ✅ Rota: `<Route path="/resources" element={<Resources />} />`

2. **src/components/AppLayout.tsx**
   - ✅ Link adicionado no UserFooter: "Documentação" → `/resources`

3. **src/pages/Landing.tsx**
   - ✅ Link adicionado no footer: "Documentação" → `/resources`

### Arquivos Criados

1. **src/pages/Resources.tsx**
   - ✅ Página de documentação com cards dos guias
   - ✅ Botões de download funcionais
   - ✅ Links para outras docs
   - ✅ Informações de contato

2. **public/docs/Face_Lab_Producer_Guide.pdf**
   - ✅ PDF para producers (7 KB)

3. **public/docs/Face_Lab_Guest_Guide.pdf**
   - ✅ PDF para guests (9 KB)

---

## 🚀 Build & Deploy

### Desenvolvimento Local

```bash
cd apps/web
pnpm dev
```

Acessar:
- Landing: http://localhost:5173
- Recursos: http://localhost:5173/resources
- PDFs: http://localhost:5173/docs/...

### Build para Produção

```bash
cd apps/web
pnpm build
```

**Resultado**:
- PDFs são copiados automaticamente para `dist/docs/`
- Página Resources compilada
- Links funcionais em produção

### Deploy

PDFs são servidos como arquivos estáticos:
- Nginx/Apache: `alias public/docs /docs`
- Vercel: `public/` → `/`
- GitHub Pages: `public/` → `/`

---

## 🎨 Customização Futura

### Logo
Para adicionar logo no header:
1. Adicionar arquivo PNG/SVG em `public/images/`
2. Atualizar `Resources.tsx` linha ~10 com `<img src="/images/logo.png" />`

### Cores
Cores estão definidas em `Resources.tsx`:
- Azul primário: `#1e40af`
- Azul secundário: `#3b82f6`
- Verde (Guest): `#16a34a`

Para customizar, editar as strings de cor nos cards.

### Conteúdo
Para atualizar PDF ou descrições:
1. Editar `generate_role_pdfs.py` (se regenerar PDFs)
2. Editar `Resources.tsx` para atualizar descrições/links

---

## 📊 Estatísticas

| Item | Tamanho | Tipo |
|---|---|---|
| Producer Guide | 7 KB | PDF |
| Guest Guide | 9 KB | PDF |
| Resources.tsx | ~5 KB | TypeScript/React |
| Total Adicionado | ~21 KB | Assets + Page |

---

## 🔍 Verificação

### Checklist de Deploy

- [ ] PDFs estão em `public/docs/`
- [ ] `Resources.tsx` compilado sem erros
- [ ] Rota `/resources` funciona
- [ ] Links na landing page funcionam
- [ ] Links no menu funcionam
- [ ] Downloads dos PDFs funcionam
- [ ] Responsive em mobile
- [ ] Links externos abrem corretamente

---

## 📞 Suporte

Se os PDFs não aparecerem:

1. **PDFs 404**:
   - Verificar se `public/docs/` existe
   - Rodar `pnpm build`
   - Verificar path no nginx/servidor

2. **Página Resources 404**:
   - Verificar se `Routes` foi atualizado em `App.tsx`
   - Verificar se `Resources.tsx` está em `src/pages/`
   - Rodar `pnpm dev` para reload

3. **Links quebrados**:
   - Verificar URLs no `AppLayout.tsx` e `Landing.tsx`
   - Verificar se import está correto

---

## 🎯 Próximos Passos

- [ ] Adicionar versão/data nos PDFs (automática via `generate_role_pdfs.py`)
- [ ] Traduzir PDFs para EN/ES/FR
- [ ] Adicionar QR code nos PDFs com link pro app
- [ ] Adicionar screenshots do app nos PDFs (future versions)
- [ ] Criar página de "Documentação Técnica" com links para GitHub/FEATURES.md
- [ ] Analytics para tracking de downloads

---

*Integração concluída: Julho 2026*  
*Versão: Gato-Veloz-v0.1*
