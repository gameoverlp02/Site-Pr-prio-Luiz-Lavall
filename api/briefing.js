var https = require('https');

var SERVICE_LABELS = {
  marca: 'Criação de marca',
  site: 'Criação de site',
  redes: 'Gestão de redes sociais',
  grafica: 'Produção gráfica',
  outro: 'Outro',
  conversar: 'Ainda não sei, quero conversar'
};

var EMPRESA_STATUS_LABELS = {
  sim: 'Sim',
  nao_informar: 'Não posso informar',
  sem_nome: 'Ainda não tem nome'
};

var EMPRESA_TAMANHO_LABELS = {
  sou_eu: 'Sou eu mesmo',
  ate_10: 'Até 10',
  '11_50': '11 a 50',
  '51_200': '51 a 200',
  '200_mais': 'Mais de 200'
};

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
  });
}

function readJsonBody(req) {
  return new Promise(function(resolve, reject){
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var chunks = [];
    req.on('data', function(c){ chunks.push(c); });
    req.on('end', function(){
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
      catch (e) { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

function buildHtml(d) {
  var servicos = (d.servicos || []).map(function(s){ return SERVICE_LABELS[s] || s; });
  if (d.servicos_outro) {
    var i = servicos.indexOf(SERVICE_LABELS.outro);
    if (i >= 0) servicos[i] = 'Outro: ' + d.servicos_outro;
  }
  var rows = [
    ['Nome', d.nome],
    ['E-mail', d.email],
    ['Empresa', EMPRESA_STATUS_LABELS[d.empresa_status] || d.empresa_status],
    ['Nome da empresa', d.empresa_nome],
    ['Tamanho da empresa', EMPRESA_TAMANHO_LABELS[d.empresa_tamanho] || d.empresa_tamanho],
    ['Cargo/função', d.cargo],
    ['Serviços', servicos.join(', ')],
    ['Desafios', d.desafios],
    ['WhatsApp', d.whatsapp_optin === 'sim' ? (d.whatsapp || '(sim, sem número)') : 'Prefere contato por e-mail']
  ];
  var html = '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#141414;">'
    + '<h2 style="font-family:Georgia,serif;font-weight:400;font-size:20px;margin:0 0 16px;">Novo briefing recebido</h2>';
  rows.forEach(function(r){
    if (!r[1]) return;
    html += '<p style="margin:0 0 10px;"><strong>' + escapeHtml(r[0]) + ':</strong><br>'
      + escapeHtml(r[1]).replace(/\n/g, '<br>') + '</p>';
  });
  html += '</div>';
  return html;
}

function buildText(d) {
  var servicos = (d.servicos || []).map(function(s){ return SERVICE_LABELS[s] || s; });
  if (d.servicos_outro) {
    var i = servicos.indexOf(SERVICE_LABELS.outro);
    if (i >= 0) servicos[i] = 'Outro: ' + d.servicos_outro;
  }
  var lines = [
    'Novo briefing recebido',
    '',
    'Nome: ' + (d.nome || ''),
    'E-mail: ' + (d.email || ''),
    'Empresa: ' + (EMPRESA_STATUS_LABELS[d.empresa_status] || d.empresa_status || ''),
  ];
  if (d.empresa_nome) lines.push('Nome da empresa: ' + d.empresa_nome);
  if (d.empresa_tamanho) lines.push('Tamanho: ' + (EMPRESA_TAMANHO_LABELS[d.empresa_tamanho] || d.empresa_tamanho));
  if (d.cargo) lines.push('Cargo: ' + d.cargo);
  lines.push('Serviços: ' + servicos.join(', '));
  lines.push('', 'Desafios:', d.desafios || '');
  lines.push('', 'WhatsApp: ' + (d.whatsapp_optin === 'sim' ? (d.whatsapp || '(sim, sem número)') : 'Prefere contato por e-mail'));
  return lines.join('\n');
}

function sendViaResend(payload) {
  return new Promise(function(resolve, reject){
    var data = JSON.stringify(payload);
    var req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, function(res){
      var chunks = [];
      res.on('data', function(c){ chunks.push(c); });
      res.on('end', function(){
        var body = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
        else reject(new Error('Resend ' + res.statusCode + ': ' + body));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Método não permitido' }));
  }

  var data;
  try { data = await readJsonBody(req); }
  catch (e) {
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

  var to = process.env.BRIEFING_TO || 'luizpaulo.lavall@gmail.com';
  var from = process.env.BRIEFING_FROM || 'briefing@luizlavall.com.br';
  var subject = 'Novo briefing — ' + data.nome;

  if (!process.env.RESEND_API_KEY) {
    console.log('[briefing] RESEND_API_KEY ausente. Conteúdo recebido:\n' + buildText(data));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: true, dev: true }));
  }

  try {
    await sendViaResend({
      from: from,
      to: [to],
      reply_to: data.email,
      subject: subject,
      html: buildHtml(data),
      text: buildText(data)
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('[briefing] erro ao enviar:', err.message);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Falha ao enviar o briefing.' }));
  }
};
