# Deploy na Vercel

## Passos para configurar o deploy automático:

### 1. Acesse a Vercel
- Vá para https://vercel.com
- Faça login com sua conta GitHub

### 2. Importe o Projeto
- Clique em "New Project"
- Selecione o repositório: **Site-Pr-prio-Luiz-Lavall**
- Clique em "Import"

### 3. Configuração do Build
A Vercel deve detectar automaticamente:
- **Framework Preset**: Other
- **Build Command**: `npm run build` (ou deixar em branco)
- **Output Directory**: `.`
- **Root Directory**: `./`

Se não detectar, configure manualmente.

### 4. Variáveis de Ambiente
Não há variáveis necessárias por enquanto. Deixe em branco.

### 5. Deploy Inicial
- Clique em "Deploy"
- Aguarde ~2-3 minutos para completar

### 6. Conectar Domínio
Após o deploy inicial:
- Vá até a página do projeto na Vercel
- Clique em "Settings" → "Domains"
- Clique em "Add Domain"
- Digite: **luizlavall.com.br**
- A Vercel verificará o DNS automaticamente
- Clique em "Continue"

Se o DNS já está apontando para Vercel:
- Deve detectar automaticamente
- Clique em "Verify" ou "Confirm"

### 7. Verificar HTTPS
- Vercel emite certificado SSL automaticamente
- Espere 5-10 minutos para ativar

### 8. Deploy Automático
Agora, toda vez que você fizer push no GitHub:
```bash
git add .
git commit -m "Sua mensagem"
git push origin main
```

A Vercel **automaticamente**:
1. Detecta o novo push
2. Faz o build
3. Deploy para produção

## Acessar o Site
- https://luizlavall.com.br
- https://www.luizlavall.com.br (se configurado)

## Dados Local vs Vercel

**Local (localhost:8080)**:
- Acesso a `/admin` ✅
- Dados persistem em `data/` ✅
- Uploads em `uploads/` ✅

**Vercel (luizlavall.com.br)**:
- Sem acesso a `/admin` ❌
- Dados são apenas leitura (fallback) ❌
- Sem persistência entre deploys ❌

Se precisar de dados dinâmicos na produção, integre:
- Supabase (banco de dados + auth)
- MongoDB + Atlas
- Firebase Realtime Database
