const { Resend } = require('resend');

const SERVICE_LABELS = {
  marca: 'Criação de marca',
  site: 'Criação de site',
  redes: 'Gestão de redes sociais',
  grafica: 'Produção gráfica',
  outro: 'Outro',
  conversar: 'Ainda não sei, quero conversar',
};

const EMPRESA_STATUS_LABELS = {
  sim: 'Sim',
  nao_informar: 'Não posso informar',
  sem_nome: 'Ainda não tem nome',
};

const EMPRESA_TAMANHO_LABELS = {
  sou_eu: 'Sou eu mesmo',
  ate_10: 'Até 10',
  '11_50': '11 a 50',
  '51_200': '51 a 200',
  '200_mais': 'Mais de 200',
};

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
      catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

function buildHtml(d) {
  const servicos = (d.servicos || []).map((s) => SERVICE_LABELS[s] || s);
  if (d.servicos_outro) {
    const i = servicos.indexOf(SERVICE_LABELS.outro);
    if (i >= 0) servicos[i] = 'Outro: ' + d.servicos_outro;
  }
  const rows = [
    ['Nome', d.nome],
    ['E-mail', d.email],
    ['Empresa', EMPRESA_STATUS_LABELS[d.empresa_status] || d.empresa_status],
    ['Nome da empresa', d.empresa_nome],
    ['Tamanho da empresa', EMPRESA_TAMANHO_LABELS[d.empresa_tamanho] || d.empresa_tamanho],
    ['Cargo / função', d.cargo],
    ['Serviços', servicos.join(', ')],
    ['Desafios', d.desafios],
    ['WhatsApp', d.whatsapp_optin === 'sim' ? (d.whatsapp || '(sim, sem número)') : 'Prefere contato por e-mail'],
  ];
  let html = '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#141414;">'
    + '<h2 style="font-family:Georgia,serif;font-weight:400;font-size:20px;margin:0 0 20px;">Novo briefing recebido</h2>';
  for (const [label, value] of rows) {
    if (!value) continue;
    html += `<p style="margin:0 0 12px;"><strong>${escapeHtml(label)}:</strong><br>${escapeHtml(value).replace(/\n/g, '<br>')}</p>`;
  }
  html += '</div>';
  return html;
}

function buildText(d) {
  const servicos = (d.servicos || []).map((s) => SERVICE_LABELS[s] || s);
  if (d.servicos_outro) {
    const i = servicos.indexOf(SERVICE_LABELS.outro);
    if (i >= 0) servicos[i] = 'Outro: ' + d.servicos_outro;
  }
  const lines = [
    'Novo briefing recebido',
    '',
    `Nome: ${d.nome || ''}`,
    `E-mail: ${d.email || ''}`,
    `Empresa: ${EMPRESA_STATUS_LABELS[d.empresa_status] || d.empresa_status || ''}`,
  ];
  if (d.empresa_nome) lines.push(`Nome da empresa: ${d.empresa_nome}`);
  if (d.empresa_tamanho) lines.push(`Tamanho: ${EMPRESA_TAMANHO_LABELS[d.empresa_tamanho] || d.empresa_tamanho}`);
  if (d.cargo) lines.push(`Cargo: ${d.cargo}`);
  lines.push(`Serviços: ${servicos.join(', ')}`);
  lines.push('', 'Desafios:', d.desafios || '');
  lines.push('', `WhatsApp: ${d.whatsapp_optin === 'sim' ? (d.whatsapp || '(sim, sem número)') : 'Prefere contato por e-mail'}`);
  return lines.join('\n');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Método não permitido' }));
  }

  let data;
  try { data = await readJsonBody(req); }
  catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'JSON inválido' }));
  }

  if (!data || !data.nome || !data.email || !data.desafios) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Faltam campos obrigatórios' }));
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'E-mail inválido' }));
  }

  if (!process.env.RESEND_API_KEY) {
    console.log('[briefing] RESEND_API_KEY ausente. Conteúdo recebido:\n' + buildText(data));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: true, dev: true }));
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const from = process.env.BRIEFING_FROM || 'onboarding@resend.dev';
  const to   = process.env.BRIEFING_TO   || 'luizpaulo.lavall@gmail.com';

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      reply_to: data.email,
      subject: `Novo briefing — ${data.nome}`,
      html: buildHtml(data),
      text: buildText(data),
    });

    if (error) {
      console.error('[briefing] Resend error:', error);
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'Falha ao enviar o briefing.' }));
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('[briefing] erro inesperado:', err.message);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Falha ao enviar o briefing.' }));
  }
};
