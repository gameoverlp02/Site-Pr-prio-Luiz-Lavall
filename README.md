# Luiz Lavall - Site

Site portfolio de Luiz Lavall, designer e comunicador.

## Local

```bash
npm install
npm start
```

Acessa em `http://localhost:8080`

Admin: `http://localhost:8080/admin`

## Deploy (Vercel)

1. Conectar repo no GitHub
2. Importar na Vercel
3. Auto-deploy a cada push

O `/admin` fica só local.

## Estrutura

- `*.html` - Páginas públicas
- `server.js` - Servidor local (Node)
- `api/serve.js` - API para Vercel
- `data/` - JSON dos projetos (local)
- `uploads/` - Mídia (local)
- `admin/` - Painel (local)
- Fontes: `margem condensed/`, `pp editorial new/`

## Dados

Para atualizar conteúdo:

1. Local: use `/admin`
2. Vercel: os dados ficarão em `/data` (não persistem entre deploys)

Se precisar dados persistentes na nuvem, integrate com banco de dados (Supabase, MongoDB, etc).
