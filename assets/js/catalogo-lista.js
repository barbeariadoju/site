// v29.243.0 — A lista de serviços do site, uma só, para qualquer tela que ofereça serviço.
//
// Pedido do Juliano (26/09/2026), olhando o /agendar/ ao lado dos chips da senha: "acho este
// modelo mais bonito; poderíamos padronizar em todos agendamentos". O /agendar/ é a fonte:
// esta função busca a página e transplanta as `section.service-section` (título da categoria,
// selo "Mais procurado", descrição, duração, preço, botão Adicionar). Não há segunda cópia dos
// 24 serviços para envelhecer. Se o fetch falhar (offline, cache estranho), monta a mesma
// marcação a partir de window.BDJ_SERVICES. O visual é o css/07-catalogo-lista.css.
//
// Preço e duração que vão pro servidor NUNCA saem daqui: vêm do services-catalog (que sabe a
// vigência do reajuste); o HTML do /agendar/ só desenha.
//
// Uso:
//   const box=await montarLista(el,{permitidos:n=>..., aoClicar:nome=>..., aoRemover:nome=>...});
//   pintarLista(el,['Corte de cabelo']);                       // marca ✓ Adicionado
//   pintarLista(el,[],{quantidades:new Map([['Corte',2]])});    // vale-presente: "− 2" ao lado

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
// Preço inteiro sai como "R$ 40" (é assim no /agendar/); com centavos, "R$ 12,50".
const precoCurto=v=>{const n=Number(v||0);return Number.isInteger(n)?`R$ ${n}`:money(n)};

let cacheSecoes=null;
export async function carregarSecoesDoAgendar(){
  if(cacheSecoes)return cacheSecoes;
  const html=await (await fetch('/agendar/',{credentials:'same-origin'})).text();
  const doc=new DOMParser().parseFromString(html,'text/html');
  const secoes=[...doc.querySelectorAll('section.service-section')];
  if(!secoes.length)throw new Error('sem service-section no /agendar/');
  cacheSecoes=secoes;
  return secoes;
}

// Mesma marcação do /agendar/, gerada a partir de itens {name,price,duration,description,category}.
// Sem categoria, tudo vai numa seção só com o `titulo` (produtos, por exemplo).
export function secoesDeItens(itens,{titulo='Serviços',descricao=''}={}){
  const grupos=new Map();
  for(const s of itens){const k=s.category||titulo;if(!grupos.has(k))grupos.set(k,[]);grupos.get(k).push(s)}
  const tpl=document.createElement('template');
  tpl.innerHTML=[...grupos].map(([cat,lista])=>`<section class="section service-section"><div class="section-head"><h2>${esc(cat)}.</h2>${descricao?`<p>${esc(descricao)}</p>`:''}</div><div class="service-grid">${lista.map(s=>`<article class="service-card"><div class="service-content"><h3>${esc(s.name)}</h3>${s.description?`<p>${esc(s.description)}</p>`:''}</div><div class="service-meta">${s.duration?`<span>aproximadamente ${Number(s.duration)} min</span>`:''}<strong>${precoCurto(s.price)}</strong></div><button class="service-btn" data-name="${esc(s.name)}" type="button">Adicionar</button></article>`).join('')}</div></section>`).join('');
  return [...tpl.content.querySelectorAll('section.service-section')];
}

// Monta a lista dentro de `box`. `itens` é a fonte de verdade (default: BDJ_SERVICES): cartão do
// /agendar/ cujo nome não está em `itens` some; `permitidos(nome)` filtra ainda mais (vale-presente
// só vende corte/barba/acabamento). `fonte:'itens'` pula o fetch e desenha direto dos itens (produtos).
export async function montarLista(box,{itens,fonte='agendar',permitidos,aoClicar,aoRemover,titulo,descricao}={}){
  const lista=Array.isArray(itens)?itens:(Array.isArray(window.BDJ_SERVICES)?window.BDJ_SERVICES:[]);
  const nomes=new Set(lista.map(s=>s.name));
  let secoes=[];
  if(fonte==='agendar'){
    try{secoes=(await carregarSecoesDoAgendar()).map(sec=>document.importNode(sec,true))}
    catch(e){console.warn('[catalogo-lista] /agendar/ indisponível, montando pelo catálogo',e)}
  }
  if(!secoes.length)secoes=secoesDeItens(lista,{titulo,descricao});
  box.classList.add('catalogo-lista');
  box.innerHTML='';
  for(const sec of secoes){
    sec.removeAttribute('id');sec.removeAttribute('style');
    sec.querySelectorAll('script,link,style').forEach(el=>el.remove());
    sec.querySelectorAll('a[href]').forEach(a=>a.replaceWith(...a.childNodes));
    sec.querySelectorAll('.service-btn').forEach(b=>{
      const nome=b.dataset.name||'';
      if(!nomes.has(nome)||(permitidos&&!permitidos(nome))){b.closest('.service-card')?.remove();return}
      if(!b.dataset.label)b.dataset.label=b.textContent.trim()||'Adicionar';
      b.setAttribute('aria-pressed','false');
    });
    if(sec.querySelector('.service-card'))box.appendChild(sec);
  }
  box.addEventListener('click',e=>{
    const menos=e.target.closest('[data-menos]');
    if(menos){aoRemover?.(menos.dataset.menos,menos);return}
    const b=e.target.closest('.service-btn');
    if(!b||!box.contains(b))return;
    aoClicar?.(b.dataset.name||'',b);
    b.classList.add('just-added');setTimeout(()=>b.classList.remove('just-added'),600);
  });
  return box;
}

// Estado visual: is-added + aria-pressed + "✓ Adicionado" (o mesmo do carrinho do site).
// Com `quantidades` (Map nome→n), o botão segue "Adicionar" e aparece "− n" ao lado — é o
// vale-presente, onde o mesmo serviço pode entrar mais de uma vez.
export function pintarLista(box,escolhidos=[],{quantidades}={}){
  const set=new Set(escolhidos);
  box.querySelectorAll('.service-btn').forEach(b=>{
    const nome=b.dataset.name||'';
    const card=b.closest('.service-card');
    if(quantidades){
      const n=quantidades.get(nome)||0;
      let q=card?.querySelector('.service-qty');
      if(n&&!q){q=document.createElement('span');q.className='service-qty';b.before(q)}
      if(q){if(n){q.innerHTML=`<button type="button" class="service-qty-menos" data-menos="${esc(nome)}" aria-label="Tirar um ${esc(nome)}">−</button><b>${n}</b>`}else q.remove()}
      b.classList.toggle('is-added',false);b.setAttribute('aria-pressed',n?'true':'false');b.textContent=n?'Adicionar mais um':b.dataset.label;
      card?.classList.toggle('is-selected',n>0);
      return;
    }
    const on=set.has(nome);
    b.classList.toggle('is-added',on);b.setAttribute('aria-pressed',on?'true':'false');b.textContent=on?'✓ Adicionado':b.dataset.label;
    card?.classList.toggle('is-selected',on);
  });
}
