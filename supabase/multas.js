'use strict';
const F=window.Faxinas, $=F.$;
let multas=[];
function render() {
  const pessoa=F.profile.is_admin?$('filtroPessoa').value:F.profile.pessoa;
  const mes=$('mes').value;
  const filtradas=multas.filter(m=>(!pessoa || m.pessoa===pessoa) && (!mes || m.dia_vencimento.startsWith(mes)));
  const summary=$('resumoMultas');summary.replaceChildren();
  const months=new Map();
  for(const m of filtradas) {
    const key=m.dia_vencimento.slice(0,7);const group=months.get(key)||{count:0,total:0};group.count++;group.total+=Number(m.valor_multa);months.set(key,group);
  }
  for(const [key,group] of [...months].sort(([a],[b])=>b.localeCompare(a))) {
    const label=new Date(key+'-01T12:00:00Z').toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});
    const card=F.element('article',null,'month-card');
    card.append(F.element('h3',label),F.element('p',`${group.count} ${group.count===1?'multa':'multas'}`),F.element('strong',F.money(group.total)));summary.append(card);
  }
  const box=$('listaMultas');box.replaceChildren();
  if(!filtradas.length){box.append(F.element('p','Nenhuma multa encontrada para este período.','muted'));return;}
  box.append(F.element('h3',`Total: ${filtradas.length} ${filtradas.length===1?'multa':'multas'} • ${F.money(filtradas.reduce((s,m)=>s+Number(m.valor_multa),0))}`));
  for(const m of filtradas) {
    const card=F.element('article',null,'fine-card');
    card.append(F.element('h3',`${m.pessoa} • ${F.money(m.valor_multa)}`),F.element('p',m.tarefa),F.element('p',`Dia em que terminou o prazo: ${F.day(m.dia_vencimento)}`),F.element('p',`${m.bloco==='dom_seg_ter'?'DOM/SEG/TER':'QUI/SEX/SÁB'} • Semana de ${F.day(m.semana)}`),F.element('span','Não concluída','badge nao_concluida'));
    if(F.profile.is_admin)card.append(F.element('p','Para corrigir a tarefa e remover a multa, acesse Minhas faxinas.','muted'));
    box.append(card);
  }
}
async function carregar() {
  const dados=await F.rpc('faxina_listar');multas=dados.filter(m=>Number(m.valor_multa)>0);
  const selected=$('mes').value;$('mes').replaceChildren(F.element('option','Todos os meses'));$('mes').firstChild.value='';
  for(const key of [...new Set(multas.map(m=>m.dia_vencimento.slice(0,7)))].sort().reverse()) {
    const option=F.element('option',new Date(key+'-01T12:00:00Z').toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}));option.value=key;$('mes').append(option);
  }
  if([...$('mes').options].some(o=>o.value===selected))$('mes').value=selected;
  render();
}
$('mes').onchange=render;$('filtroPessoa').onchange=render;
F.start(carregar);
