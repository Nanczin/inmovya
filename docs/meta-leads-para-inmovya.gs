/**
 * Meta Lead Ads (Google Sheets) → Inmovya
 * Envia para o Inmovya cada linha nova que a Meta grava nesta planilha.
 * Roda sozinho a cada 1 minuto depois de executar a função "instalar" uma vez.
 */

const INMOVYA_URL = 'https://hhtzdxtythejyykrpgqw.supabase.co/functions/v1/lead-intake';

// Coloque aqui a MESMA palavra-senha que você salvou no Supabase como INTAKE_SECRET
const SEGREDO = 'COLE_AQUI_A_PALAVRA_SENHA';

const IGNORAR = ['id', 'created_time', 'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id',
  'form_id', 'form_name', 'is_organic', 'platform', 'lead_status', 'inmovya'];

function enviarNovosLeads() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return;

  const head = data[0].map(function (h) { return String(h).toLowerCase().trim(); });
  let col = head.indexOf('inmovya');
  if (col < 0) {
    col = head.length;
    sh.getRange(1, col + 1).setValue('inmovya');
  }

  const achar = function (nomes) {
    return head.findIndex(function (h) { return nomes.some(function (n) { return h === n || h.indexOf(n) >= 0; }); });
  };
  const iNome = achar(['full_name', 'nome_completo', 'nome', 'name']);
  const iTel = achar(['phone_number', 'telefone', 'celular', 'whatsapp', 'phone']);
  const iEmail = achar(['email', 'e-mail']);
  const iCamp = achar(['campaign_name', 'campanha']);
  const iAnuncio = achar(['ad_name']);
  const iPlat = achar(['platform']);

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[col]) continue; // já enviado
    if (!row[iNome] && !row[iTel]) continue;

    const usados = [iNome, iTel, iEmail, iCamp, col];
    const extras = head
      .map(function (h, i) { return [h, row[i], i]; })
      .filter(function (x) { return x[1] !== '' && usados.indexOf(x[2]) < 0 && IGNORAR.indexOf(x[0]) < 0; })
      .map(function (x) { return x[0].replace(/_/g, ' ') + ': ' + x[1]; });
    if (iAnuncio >= 0 && row[iAnuncio]) extras.unshift('Anúncio: ' + row[iAnuncio]);

    const plataforma = iPlat >= 0 ? String(row[iPlat]).toLowerCase() : '';
    const payload = {
      nome: iNome >= 0 ? String(row[iNome]) : '',
      telefone: iTel >= 0 ? String(row[iTel]).replace(/^p:/i, '') : '',
      email: iEmail >= 0 ? String(row[iEmail]) : '',
      origem: plataforma === 'ig' || plataforma === 'instagram' ? 'Instagram' : 'Facebook',
      campanha: iCamp >= 0 ? String(row[iCamp]) : '',
      observacoes: extras.join(' | '),
      fonte: 'Meta Ads',
      tags: ['Meta Ads']
    };

    const res = UrlFetchApp.fetch(INMOVYA_URL + '?token=' + encodeURIComponent(SEGREDO), {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const status = res.getResponseCode();
    const quando = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM HH:mm');
    if (status === 200) {
      sh.getRange(r + 1, col + 1).setValue('enviado ' + quando);
    } else {
      console.log('Erro ' + status + ' na linha ' + (r + 1) + ': ' + res.getContentText());
    }
  }
}

/** Execute UMA vez: liga o envio automático a cada 1 minuto e já envia o que estiver pendente. */
function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'enviarNovosLeads') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('enviarNovosLeads').timeBased().everyMinutes(1).create();
  enviarNovosLeads();
}
