// admin-v15-4-expediente.js — Abrir / Fechar a barbearia na tela Hoje (v29.242.0, 26/09/2026).
//
// Mesmo escopo global dos outros admin-v15-4-*.js (sem IIFE, de propósito — ver header do
// core): usa sb, allBookings, esc, money, isoLocal, $, BDJ_UX, loadBaseData, renderDashboard
// e setStatus (agenda). Carregar DEPOIS de core/dashboard/agenda e ANTES do bootstrap.
//
// Pedido do Juliano: "abrir registra a hora que comecei a trabalhar; fechar, a hora que parei;
// em dia que eu for embora mais cedo, ao fechar tranca a agenda". O que faz cada botão:
//   Abrir   -> expediente_abrir: grava aberto_em (ou REABRE um dia fechado mais cedo, apagando
//              o bloqueio).
//   Fechar  -> mostra quem ainda está marcado pra hoje (expediente_pendentes) com "Cancelar e
//              avisar" (o cancelamento normal do painel, que manda o WhatsApp) ou "Manter";
//              depois expediente_fechar(motivo): grava fechado_em e cria o bloqueio até o fim
//              do dia (site, JuIA e Senha Digital param de oferecer horário na hora).
//   Histórico -> últimos 14 dias: abriu, fechou, horas, atendimentos e faturado.
// O cron bdj-expediente (function expediente-dia) lembra de abrir às 8h15 e fecha sozinho
// 30 min depois do expediente se ninguém clicou — registro marcado "automático".

const EXPEDIENTE_MOTIVOS=[['','Sem motivo especial'],['sem_cliente','Sem cliente marcado'],['mais_cedo','Fui embora mais cedo'],['emergencia','Emergência / imprevisto'],['evento','Evento / compromisso'],['outro','Outro']];
const EXPEDIENTE_MOTIVO_LABEL=Object.fromEntries(EXPEDIENTE_MOTIVOS);
let expedienteCache={};

function expedienteHora(ts){return ts?new Date(ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):''}
function expedienteDuracao(a,b){
  if(!a)return '';
  const ms=(b?new Date(b):new Date())-new Date(a);if(!(ms>0))return '0min';
  const m=Math.round(ms/60000),h=Math.floor(m/60),r=m%60;
  return h?`${h}h${String(r).padStart(2,'0')}`:`${r}min`;
}
function expedienteOrigem(por){return por==='automatico'?' <small title="Registrado pelo fechamento automático, não pelo botão">(automático)</small>':''}

async function carregarExpediente(dia){
  if(!sb)return null;
  const {data,error}=await sb.from('expediente').select('*').eq('dia',dia).maybeSingle();
  if(error){console.error('[expediente] carregar',error);return null}
  expedienteCache[dia]=data||null;
  return data||null;
}

// Chamado pelo renderDashboard (dashboard.js) a cada redesenho da tela Hoje.
async function renderExpediente(today,ehHoje){
  const box=$('today-expediente'),btn=$('today-expediente-btn');
  if(!box||!btn||!sb)return;
  const e=await carregarExpediente(today);
  if(!btn.dataset.bound){btn.dataset.bound='1';btn.addEventListener('click',onExpedienteClick)}
  btn.hidden=!ehHoje;
  let texto='',acao='';
  if(!e||!e.aberto_em){
    texto=ehHoje?'<b>Barbearia ainda não aberta hoje.</b> Toque em Abrir quando começar o expediente — é o que registra suas horas.':'<b>Sem registro de expediente neste dia.</b>';
    acao='🔓 Abrir a barbearia';
  }else if(!e.fechado_em){
    texto=`<b>Aberta desde ${expedienteHora(e.aberto_em)}</b>${expedienteOrigem(e.aberto_por)} · há ${expedienteDuracao(e.aberto_em)}${e.observacao?` · <i>${esc(e.observacao)}</i>`:''}`;
    acao='🔒 Fechar a barbearia';
  }else{
    const motivo=e.motivo?` · ${esc(EXPEDIENTE_MOTIVO_LABEL[e.motivo]||e.motivo)}`:'';
    texto=`<b>Fechada às ${expedienteHora(e.fechado_em)}</b>${expedienteOrigem(e.fechado_por)}${motivo} · aberta das ${expedienteHora(e.aberto_em)} às ${expedienteHora(e.fechado_em)} = <b>${expedienteDuracao(e.aberto_em,e.fechado_em)}</b>${e.bloqueio_id?' · agenda trancada pro resto do dia':''}`;
    acao='🔓 Reabrir';
  }
  btn.textContent=acao;btn.dataset.acao=acao.includes('Fechar')?'fechar':'abrir';
  box.innerHTML=`<span>${texto}</span> <button type="button" class="booking-text-button" data-expediente-historico>Histórico →</button>`;
  box.hidden=false;
  box.querySelector('[data-expediente-historico]')?.addEventListener('click',abrirHistoricoExpediente);
}

async function onExpedienteClick(e){
  const btn=e.currentTarget;
  if(btn.dataset.acao==='fechar')return abrirModalFechar();
  BDJ_UX.setBusy(btn,true,'Abrindo…');
  try{
    const {data,error}=await sb.rpc('expediente_abrir');
    if(error)throw error;
    const reabriu=data&&data.fechado_em==null&&expedienteCache[isoLocal(new Date())]?.fechado_em;
    BDJ_UX.toast(reabriu?'Barbearia reaberta: a agenda voltou a receber horário.':`Barbearia aberta às ${expedienteHora(data?.aberto_em)}.`,'success');
    await loadBaseData();renderDashboard();
  }catch(err){alert(err?.message||'Não foi possível abrir agora.')}
  finally{BDJ_UX.setBusy(btn,false)}
}

function expedienteModal(id,html){
  let modal=document.getElementById(id);
  if(modal)modal.remove();
  modal=document.createElement('div');modal.id=id;modal.className='admin-modal';
  modal.innerHTML=`<div class="admin-modal-backdrop" data-modal-close></div><section class="admin-modal-card" role="dialog" aria-modal="true">${html}</section>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-modal-close]').forEach(el=>el.addEventListener('click',()=>modal.remove()));
  return modal;
}

async function abrirModalFechar(){
  let pendentes=[];
  try{const {data,error}=await sb.rpc('expediente_pendentes');if(error)throw error;pendentes=data||[]}catch(err){alert(err?.message||'Não foi possível conferir a agenda.');return}
  const lista=pendentes.length
    ?`<p><b>Ainda tem gente marcada pra hoje.</b> Resolva um por um antes de fechar — quem ficar continua com o horário garantido; só não entra mais ninguém novo.</p><div class="admin-expediente-pendentes">${pendentes.map(p=>`<div class="admin-alert-row" data-pendente="${p.id}"><span><b>${p.start_time.slice(0,5)}</b> ${esc(p.customer_name)}<br><small>${esc(p.service_name)}${p.channel==='porta'?' · senha digital':''}</small></span><span><button type="button" class="btn ghost is-danger" data-cancelar="${p.id}">Cancelar e avisar</button></span></div>`).join('')}</div>`
    :'<p>Ninguém mais marcado pra hoje. Pode fechar tranquilo.</p>';
  const modal=expedienteModal('expediente-fechar-modal',`<h2>Fechar a barbearia</h2>${lista}<label class="booking-field-v14">Motivo (opcional)<select id="expediente-motivo">${EXPEDIENTE_MOTIVOS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><p class="field-help">Ao fechar, a agenda de hoje fica trancada pro resto do dia: site, JuIA e senha digital param de oferecer horário. Se voltar, toque em Reabrir.</p><div class="admin-booking-actions"><button type="button" class="btn primary" data-fechar-agora>🔒 Fechar agora</button><button type="button" class="btn ghost" data-modal-close>Cancelar</button></div>`);
  modal.querySelectorAll('[data-cancelar]').forEach(b=>b.addEventListener('click',async ev=>{
    const id=ev.currentTarget.dataset.cancelar,row=modal.querySelector(`[data-pendente="${id}"]`);
    // setStatus já pergunta (BDJ_UX.confirm) e manda o aviso ao cliente pela function admin-booking-status.
    const b=ev.currentTarget;
    try{await setStatus(id,'cancelled',b);if(!allBookings.find(x=>x.id===id&&['pending','confirmed'].includes(x.status)))row?.remove()}catch(err){alert(err?.message||'Não foi possível cancelar.')}
  }));
  modal.querySelector('[data-fechar-agora]').addEventListener('click',async ev=>{
    const b=ev.currentTarget;BDJ_UX.setBusy(b,true,'Fechando…');
    try{
      const {data,error}=await sb.rpc('expediente_fechar',{p_motivo:$('expediente-motivo').value||null});
      if(error)throw error;
      modal.remove();
      BDJ_UX.toast(`Barbearia fechada às ${expedienteHora(data?.fechado_em)}. Hoje: ${expedienteDuracao(data?.aberto_em,data?.fechado_em)} de expediente.`,'success');
      await loadBaseData();renderDashboard();
    }catch(err){alert(err?.message||'Não foi possível fechar agora.')}
    finally{if(b.isConnected)BDJ_UX.setBusy(b,false)}
  });
}

async function abrirHistoricoExpediente(){
  const fim=new Date(),ini=new Date();ini.setDate(ini.getDate()-13);
  const {data,error}=await sb.from('expediente').select('*').gte('dia',isoLocal(ini)).lte('dia',isoLocal(fim)).order('dia',{ascending:false});
  if(error){alert(error.message);return}
  const porDia=Object.fromEntries((data||[]).map(e=>[e.dia,e]));
  const dias=[];for(let d=new Date(fim);d>=ini;d.setDate(d.getDate()-1))dias.push(isoLocal(d));
  let somaMin=0,somaAt=0,somaFat=0,diasComHoras=0;
  const linhas=dias.map(dia=>{
    const e=porDia[dia],rows=(allBookings||[]).filter(x=>x.booking_date===dia&&x.status==='completed');
    const at=rows.length,fat=rows.reduce((a,x)=>a+(x.courtesy?0:Math.max(0,Number(x.service_price||0)-Number(x.loyalty_discount||0)))+Number(x.products_price||0),0);
    const min=e?.aberto_em&&e?.fechado_em?Math.round((new Date(e.fechado_em)-new Date(e.aberto_em))/60000):0;
    if(min>0){somaMin+=min;diasComHoras++}somaAt+=at;somaFat+=fat;
    const dow=new Date(dia+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'});
    const horas=e?.aberto_em?`${expedienteHora(e.aberto_em)}–${e.fechado_em?expedienteHora(e.fechado_em):'…'}${e.fechado_por==='automatico'||e.aberto_por==='automatico'?' <small>(auto)</small>':''}`:'<small>—</small>';
    const porHora=min>0&&at?` · ${(at/(min/60)).toFixed(1)}/h`:'';
    return `<div class="admin-alert-row"><span><b>${dow}</b><br><small>${horas}${e?.motivo?` · ${esc(EXPEDIENTE_MOTIVO_LABEL[e.motivo]||e.motivo)}`:''}</small></span><strong>${min?expedienteDuracao(e.aberto_em,e.fechado_em):'—'}<br><small>${at} atend. · ${money(fat)}${porHora}</small></strong></div>`;
  }).join('');
  const media=diasComHoras?Math.round(somaMin/diasComHoras):0;
  expedienteModal('expediente-historico-modal',`<h2>Expediente — últimos 14 dias</h2><p>${diasComHoras} dia${diasComHoras===1?'':'s'} com horas registradas · média <b>${Math.floor(media/60)}h${String(media%60).padStart(2,'0')}</b> por dia · ${somaAt} atendimentos · ${money(somaFat)}${somaMin?` · <b>${(somaAt/(somaMin/60)).toFixed(1)} atendimentos por hora aberta</b>`:''}</p>${linhas}<div class="admin-booking-actions"><button type="button" class="btn ghost" data-modal-close>Fechar</button></div>`);
}
