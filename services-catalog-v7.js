window.BDJ_SERVICES = [
  {category:'Cortes e combos',name:'Corte + Lavagem',description:'Corte masculino personalizado com lavagem profissional para maior conforto, sensação de limpeza e acabamento caprichado.',price:50,priceFrom:60,duration:40},
  {category:'Cortes e combos',name:'Corte de cabelo',description:'Corte de cabelo masculino realizado com técnica, precisão e atenção aos detalhes para valorizar seu estilo.',price:40,priceFrom:50,duration:30},
  {category:'Cortes e combos',name:'Raspar a cabeça',description:'Raspagem completa da cabeça, com ou sem navalha, para um acabamento liso e impecável.',price:40,priceFrom:50,duration:30},
  {category:'Cortes e combos',name:'Corte de cabelo infantil',description:'Corte infantil feito na tesoura ou na tesoura com máquina, com toda a paciência, cuidado e capricho para o seu filho sair sorrindo — e você, tranquilo.',price:40,priceFrom:50,duration:30},
  {category:'Cortes e combos',name:'Corte + Barba na navalha com toalha quente',description:'Corte de cabelo aliado ao ritual de barba com toalha quente, navalha e acabamento caprichado.',price:80,priceFrom:95,duration:60},
  {category:'Cortes e combos',name:'Corte + Barba Express',description:'Corte masculino + alinhamento de barba em versão rápida, ideal para manutenção do visual no dia a dia.',price:65,priceFrom:80,duration:50},
  {category:'Barba',name:'Barboterapia com vaporizador de ozônio',description:'Ritual de cuidado com vaporizador de ozônio, toalha quente, espuma e acabamento com navalha.',price:50,priceFrom:60,duration:40},
  {category:'Barba',name:'Barba na navalha com toalha quente',description:'Ritual de barba completo com toalha quente, espuma, acabamento na navalha e produtos profissionais.',price:40,priceFrom:50,duration:30},
  {category:'Barba',name:'Barba Express',description:'Alinhamento rápido da barba com acabamento realizado na máquina.',price:25,priceFrom:35,duration:20},
  {category:'Acabamentos e adicionais',name:'Pezinho (acabamento)',description:'Acabamento preciso do contorno do cabelo, nuca e laterais.',price:15,priceFrom:20,duration:10},
  {category:'Acabamentos e adicionais',name:'Sobrancelha Masculina',description:'Alinhamento e limpeza da sobrancelha masculina de forma discreta e natural.',price:15,priceFrom:20,duration:10},
  {category:'Acabamentos e adicionais',name:'Depilação nasal (cera quente)',description:'Remoção dos pelos nasais com cera quente.',price:25,priceFrom:30,duration:20},
  {category:'Acabamentos e adicionais',name:'Depilação orelhas',description:'Remoção dos pelos das orelhas com cera quente.',price:25,priceFrom:30,duration:20},
  {category:'Acabamentos e adicionais',name:'Freestyle (risquinho)',description:'Desenhos e detalhes personalizados feitos no corte.',price:15,duration:10},
  {category:'Química e tratamentos',name:'Nevou / Platinado',description:'Descoloração capilar completa para efeito platinado.',price:150,duration:120},
  {category:'Química e tratamentos',name:'Luzes',description:'Aplicação de luzes para criar pontos de destaque e iluminar o cabelo.',price:120,duration:90},
  {category:'Química e tratamentos',name:'Alisamento / Relaxamento',description:'Redução de volume e alinhamento dos fios através de técnica profissional.',price:70,duration:45},
  {category:'Química e tratamentos',name:'Pigmentação Capilar (Tintura)',description:'Coloração capilar para cobertura de fios brancos ou realce do visual.',price:50,duration:30},
  {category:'Química e tratamentos',name:'Hidratação / Reconstrução Capilar',description:'Tratamento capilar focado em hidratação, reconstrução e melhora do aspecto dos fios.',price:40,priceFrom:50,duration:20},
  {category:'Pigmentações',name:'Pigmentação de Barba',description:'Pigmentação da barba para correção de falhas e aparência uniforme.',price:35,priceFrom:40,duration:20},
  {category:'Pigmentações',name:'Pigmentação de Sobrancelha',description:'Pigmentação suave da sobrancelha para correção de falhas.',price:20,priceFrom:25,duration:20},
  {category:'Pigmentações',name:'Aplicação de Fibra Capilar',description:'Preenchimento capilar imediato para disfarçar falhas e áreas rarefeitas, aplicado e finalizado no acabamento do corte. Resultado natural, resiste ao vento e sai na próxima lavagem.',price:30,priceFrom:35,duration:15},
  {category:'Estética corporal',name:'Aparação Corporal Masculina',description:'Redução uniforme dos pelos corporais (peito, abdômen, costas, ombros, braços, pernas, axilas e virilha externa) com máquina profissional, sem cera e sem arrancar os fios pela raiz. Atendimento reservado, com horário exclusivo e total discrição. Não inclui região íntima.',price:120,priceFrom:150,duration:60}
];

// v29.127.0 — O REAJUSTE DE 01/10 VIRA SOZINHO, sem ninguém publicar nada naquele dia.
//
// O problema que isto resolve: os preços do banco mudam automaticamente em 01/10 (cron
// bdj-aplicar-reajuste-agendado + service_price_changes), mas este arquivo é estático e
// estava anotado desde 30/08 como "atualizar à mão em 01/10". Se ninguém lembrasse, o site
// mostraria R$ 40 e o sistema cobraria R$ 50 — e, como todo o resto que descobrimos hoje,
// quebraria calado.
//
// Cada serviço reajustado carrega `priceFrom` (o valor novo), e a partir da data de vigência
// ele passa a valer. Sem cron, sem deploy, sem lembrete: o arquivo já sabe o futuro.
//
// Funciona mesmo com cache velho — quem tiver este .js guardado no navegador tem a REGRA
// junto, então vira na data do mesmo jeito. É por isso que a virada é por data, e não por
// publicar um arquivo novo naquele dia.
//
// Os valores de `priceFrom` vieram de service_price_changes, a MESMA tabela que o cron aplica
// no banco — site e sistema não podem divergir porque bebem da mesma fonte.
(function () {
  var VIGENCIA = '2026-10-01'; // 00:00 em America/Sao_Paulo
  var hojeSP;
  try {
    hojeSP = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  } catch (e) {
    // Navegador sem suporte a fuso: usa a data local. Na pior das hipóteses vira algumas
    // horas antes ou depois — melhor que travar o catálogo inteiro num try/catch mal posto.
    hojeSP = new Date().toISOString().slice(0, 10);
  }
  if (hojeSP < VIGENCIA) return;
  window.BDJ_SERVICES.forEach(function (s) {
    if (typeof s.priceFrom === 'number') s.price = s.priceFrom;
  });
})();
