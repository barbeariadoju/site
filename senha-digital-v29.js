// v29.241.0 — Senha Digital (26/09/2026): página /senha/ do QR da parede.
// v29.242.0 — mais de um serviço, no padrão do site: os chips usam a MESMA regra de famílias
// do carrinho (assets/js/service-rules.js: 1 corte + 1 barba, combos, pezinho incluso).
//
// Cria a senha pela function senha-digital (que usa senha_digital_criar no banco), guarda
// code+token no aparelho e mostra a posição na fila, atualizando a cada 30 s.
// O link do WhatsApp chega como /senha/#c=CODE&t=TOKEN (fragmento: não vai ao servidor).
// Leitura da URL é idempotente: o sw.js recarrega a página no controllerchange.
import { toggleServiceSelection } from '/assets/js/service-rules.js';

const $=id=>document.getElementById(id);
const cfg=window.BDJ_AGENDA_CONFIG||{};
const sb=window.supabase&&cfg.supabaseUrl?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
const CHAVE='bdj_senha_v1';
const INTERVALO=30000;
let timer=null;
let escolhidos=[];

const hojeSP=()=>new Intl.DateTimeFormat('en-CA',{timeZone:cfg.timezone||'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const agoraHHMM=()=>new Intl.DateTimeFormat('pt-BR',{timeZone:cfg.timezone||'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
const fmtTel=v=>{const p=String(v||'').replace(/\D/g,'').slice(0,11);return p.length>10?`(${p.slice(0,2)}) ${p.slice(2,7)}-${p.slice(7)}`:p.length>6?`(${p.slice(0,2)}) ${p.slice(2,6)}-${p.slice(6)}`:p.length>2?`(${p.slice(0,2)}) ${p.slice(2)}`:p};
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const catalogo=()=>Array.isArray(window.BDJ_SERVICES)?window.BDJ_SERVICES:[];
const servico=nome=>catalogo().find(s=>s.name===nome);

function lerGuardado(){try{const r=JSON.parse(localStorage.getItem(CHAVE)||'null');return r&&r.code&&r.token&&r.dia===hojeSP()?r:null}catch{return null}}
function guardar(code,token){try{localStorage.setItem(CHAVE,JSON.stringify({code,token,dia:hojeSP()}))}catch{}}
function esquecer(){try{localStorage.removeItem(CHAVE)}catch{}}

// #c=CODE&t=TOKEN vindo do WhatsApp: guarda e limpa o fragmento (idempotente).
function lerFragmento(){
  const h=new URLSearchParams((location.hash||'').replace(/^#/,''));
  const code=(h.get('c')||'').trim().toUpperCase(),token=(h.get('t')||'').trim();
  if(code&&token){guardar(code,token);history.replaceState(null,'',location.pathname)}
}

function mostrar(secao){
  for(const id of ['senha-form-secao','senha-status-secao','senha-ocupado-secao'])$(id).hidden=id!==secao;
}

// Chips por categoria; tocar liga/desliga aplicando a regra das famílias (a mensagem da
// troca aparece embaixo, como no carrinho do site).
function montarServicos(){
  const box=$('senha-servicos');box.innerHTML='';
  const grupos=new Map();
  for(const s of catalogo()){if(!grupos.has(s.category))grupos.set(s.category,[]);grupos.get(s.category).push(s)}
  for(const [cat,itens] of grupos){
    const h=document.createElement('h3');h.textContent=cat;box.appendChild(h);
    const chips=document.createElement('div');chips.className='chips';
    for(const s of itens){
      const b=document.createElement('button');b.type='button';b.className='senha-chip';b.dataset.nome=s.name;b.setAttribute('aria-pressed','false');
      b.innerHTML=`${s.name} <small>R$ ${s.price} · ${s.duration} min</small>`;
      b.addEventListener('click',()=>alternarServico(s.name));
      chips.appendChild(b);
    }
    box.appendChild(chips);
  }
}

function alternarServico(nome){
  const jaTinha=escolhidos.includes(nome);
  const r=toggleServiceSelection(escolhidos,nome);
  escolhidos=jaTinha?escolhidos.filter(n=>n!==nome):r.services;
  const regra=$('senha-regra');
  if(!jaTinha&&r.message){regra.textContent=r.message;regra.hidden=false}else{regra.textContent='';regra.hidden=true}
  pintarServicos();
}

function pintarServicos(){
  document.querySelectorAll('.senha-chip').forEach(b=>b.setAttribute('aria-pressed',escolhidos.includes(b.dataset.nome)?'true':'false'));
  const itens=escolhidos.map(servico).filter(Boolean);
  const total=itens.reduce((a,s)=>a+Number(s.price||0),0),min=itens.reduce((a,s)=>a+Number(s.duration||0),0);
  $('senha-resumo').textContent=itens.length?`${itens.map(s=>s.name).join(' + ')} · ${money(total)} · ${min} min`:'Escolha pelo menos um serviço.';
}

function erro(texto){const el=$('senha-erro');el.textContent=texto||'';el.hidden=!texto}

function pintar(s){
  $('senha-numero').textContent=s.senha!=null?String(s.senha):'—';
  $('senha-servico-nome').textContent=s.servico||'';
  $('senha-previsao').textContent=s.start_time||'--:--';
  const fila=$('senha-fila'),dica=$('senha-dica');
  fila.classList.remove('proximo');
  if(s.status==='completed'){fila.textContent='Atendimento concluído. Obrigado pela visita.';dica.textContent='Se o corte ficou do jeito que você queria, uma avaliação no Google ajuda demais.';pararAtualizacao();}
  else if(s.status==='cancelled'||s.status==='no_show'){fila.textContent='Esta senha foi cancelada.';dica.textContent='Se ainda quiser ser atendido hoje, pegue uma senha nova.';pararAtualizacao();}
  else if(s.posicao===0){fila.textContent=s.atendendo_ate?`Você é o próximo. Cadeira livre por volta das ${s.atendendo_ate}.`:'Você é o próximo. Pode entrar.';fila.classList.add('proximo');dica.textContent='Fique por perto: seu horário começa assim que a cadeira liberar.';}
  else{fila.textContent=s.posicao===1?'1 pessoa na sua frente.':`${s.posicao} pessoas na sua frente.`;dica.textContent='Pode dar uma volta no centro. Avisamos no WhatsApp quando você for o próximo.';}
  $('senha-atualizado').textContent=`Atualizado às ${agoraHHMM()}.`;
  $('senha-cancelar').hidden=!['pending','confirmed'].includes(s.status);
}

async function chamar(body){
  if(!sb)throw new Error('Serviço indisponível no momento.');
  const {data,error}=await sb.functions.invoke('senha-digital',{body});
  if(error){
    // A function responde 4xx com JSON explicando; o SDK esconde o corpo no contexto.
    let corpo=null;try{corpo=await error.context?.json?.()}catch{}
    const e=new Error(corpo?.error||'Não foi possível concluir agora.');e.corpo=corpo;throw e;
  }
  return data;
}

async function atualizar(silencioso){
  const g=lerGuardado();if(!g){mostrar('senha-form-secao');return}
  try{
    const r=await chamar({action:'status',code:g.code,token:g.token});
    if(r?.senha){mostrar('senha-status-secao');pintar(r.senha)}
  }catch(e){
    if(!silencioso)alert(e.message);
    if(/inválid|não encontrada|expirad/i.test(e.message)){esquecer();pararAtualizacao();mostrar('senha-form-secao')}
  }
}
function iniciarAtualizacao(){pararAtualizacao();timer=setInterval(()=>atualizar(true),INTERVALO)}
function pararAtualizacao(){if(timer){clearInterval(timer);timer=null}}

async function pegarSenha(ev){
  ev.preventDefault();erro('');
  const nome=$('senha-nome').value.trim().replace(/\s+/g,' ');
  const tel=$('senha-telefone').value.replace(/\D/g,'');
  const itens=escolhidos.map(servico).filter(Boolean);
  if(nome.length<2){erro('Digite seu nome.');$('senha-nome').focus();return}
  if(!/^[0-9]{10,11}$/.test(tel)){erro('Digite o WhatsApp com DDD, só números.');$('senha-telefone').focus();return}
  if(!itens.length){erro('Escolha pelo menos um serviço.');return}
  const btn=$('senha-enviar');btn.disabled=true;btn.textContent='Gerando sua senha…';
  try{
    const r=await chamar({action:'criar',customer_name:nome,customer_phone:tel,service_name:itens.map(s=>s.name).join(' + '),service_price:itens.reduce((a,s)=>a+Number(s.price||0),0),duration_minutes:itens.reduce((a,s)=>a+Number(s.duration||0),0)});
    if(r?.ok&&r.code&&r.token){guardar(r.code,r.token);mostrar('senha-status-secao');pintar(r.senha);iniciarAtualizacao();window.scrollTo({top:0,behavior:'smooth'});try{window.dataLayer.push({event:'senha_digital_criada',existente:Boolean(r.existente),servicos:itens.length})}catch{}}
    else erro(r?.error||'Não foi possível gerar a senha.');
  }catch(e){
    if(e.corpo?.motivo==='sem_horario'){$('senha-ocupado-texto').textContent=e.message;mostrar('senha-ocupado-secao')}
    else erro(e.message);
  }finally{btn.disabled=false;btn.textContent='Pegar minha senha'}
}

async function cancelar(){
  const g=lerGuardado();if(!g)return;
  if(!confirm('Cancelar sua senha de hoje?'))return;
  try{
    const {data,error}=await sb.functions.invoke('manage-booking',{body:{action:'cancel',code:g.code,token:g.token}});
    if(error)throw new Error('Não foi possível cancelar agora. Fale com o Juliano no balcão.');
    if(data?.booking)pintar({...data.booking,senha:$('senha-numero').textContent,servico:data.booking.services,posicao:null});
    esquecer();pararAtualizacao();
  }catch(e){alert(e.message)}
}

function iniciar(){
  montarServicos();
  $('senha-telefone').addEventListener('input',e=>{e.target.value=fmtTel(e.target.value)});
  $('senha-form').addEventListener('submit',pegarSenha);
  $('senha-atualizar').addEventListener('click',()=>atualizar(false));
  $('senha-cancelar').addEventListener('click',cancelar);
  $('senha-tentar').addEventListener('click',()=>mostrar('senha-form-secao'));
  lerFragmento();
  if(lerGuardado()){atualizar(false);iniciarAtualizacao()}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&lerGuardado())atualizar(true)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
