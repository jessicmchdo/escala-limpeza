'use strict';
const F=window.Faxinas, $=F.$;
let dados=[], publicadas={}, seguirSemanaAtual=true;
function renderTasks() {
  const box=$('tarefas');box.replaceChildren();
  const semana=$('filtroSemana').value;
  const tasks=dados.filter(t=>(!semana || t.semana===semana) && (F.profile.is_admin || t.pessoa===F.profile.pessoa));
  const esperadas=[];
  for(const [s,escala] of Object.entries(publicadas)) {
    if(s<'2026-09-27' || (semana && s!==semana))continue;
    for(const [pessoa,blocos] of Object.entries(escala.pessoas||{})) {
      if(!F.profile.is_admin && pessoa!==F.profile.pessoa)continue;
      for(const bloco of ['dom_seg_ter','qui_sex_sab']) {
        const tarefa=String(blocos[bloco]||'').trim();
        if(tarefa && !['FOLGA','AUSENTE'].includes(tarefa.toUpperCase()))esperadas.push({semana:s,pessoa,bloco});
      }
    }
  }
  const faltam=esperadas.filter(e=>!dados.some(t=>t.semana===e.semana && t.pessoa===e.pessoa && t.bloco===e.bloco));
  $('avisoSincronizacao').hidden=!faltam.length;
  $('avisoSincronizacao').textContent=faltam.length?'Há '+faltam.length+' tarefa(s) publicada(s) desta seleção aguardando sincronização. NAMOITA pode usar Buscar novas escalas.':'';
  if(!tasks.length){
    let mensagem=faltam.length?'As tarefas desta semana ainda não chegaram ao banco. A escala publicada foi encontrada; a sincronização precisa ser concluída.':'Nenhuma tarefa atribuída nesta seleção.';
    if(semana && !F.profile.is_admin && !faltam.length) {
      const blocos=publicadas[semana]?.pessoas?.[F.profile.pessoa];
      if(blocos)mensagem='Nesta semana: DOM/SEG/TER — '+blocos.dom_seg_ter+'; QUI/SEX/SÁB — '+blocos.qui_sex_sab+'.';
    }
    box.append(F.element('p',mensagem,'muted'));return;
  }
  for(const t of tasks) {
    const card=F.element('article',null,`task-card ${t.estado_efetivo}`);
    card.append(F.element('h3',t.tarefa));
    card.append(F.element('p',`${t.pessoa} • ${t.bloco==='dom_seg_ter'?'DOM/SEG/TER':'QUI/SEX/SÁB'} • Semana de ${F.day(t.semana)}`));
    card.append(F.element('p',`Prazo: ${F.deadline(t.prazo)} (Brasília)`));
    const labels={pendente:'Aguardando confirmação',concluida:'Concluída',nao_concluida:'Não concluída'};
    card.append(F.element('span',labels[t.estado_efetivo],'badge '+t.estado_efetivo));
    if(Number(t.valor_multa)>0)card.append(F.element('p',`Multa: ${F.money(t.valor_multa)}`,'fine-value'));
    else if(t.estado_efetivo==='nao_concluida' && !t.vencida)card.append(F.element('p','Você pode corrigir até o prazo. A multa será aplicada no vencimento se a tarefa continuar não concluída.','muted'));
    const podeAlterar=F.profile.is_admin || (t.pessoa===F.profile.pessoa && !t.vencida);
    if(podeAlterar) {
      const actions=F.element('div',null,'actions');
      for(const [estado,label] of [['concluida','Marcar como concluída'],['nao_concluida','Marcar como não concluída']]) {
        const btn=F.element('button',label,estado==='nao_concluida'?'secondary':'');
        btn.type='button';btn.disabled=t.estado===estado;
        btn.onclick=async()=>{
          const buttons=[...actions.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
          try {
            await F.rpc('faxina_marcar',{p_id:t.id,p_estado:estado});
            $('appStatus').textContent='Registro atualizado.';await carregar(F.profile);
          }catch(e){$('appStatus').textContent=F.errorMessage(e);buttons.forEach(b=>b.disabled=false);}
        };
        actions.append(btn);
      }
      card.append(actions);
      if(t.vencida && F.profile.is_admin)card.append(F.element('p','Correção administrativa: marcar como concluída remove a multa desta tarefa.','muted'));
    } else card.append(F.element('p','Prazo encerrado. Somente NAMOITA pode corrigir este registro.','muted'));
    box.append(card);
  }
}
async function carregarAcessos() {
  const users=await F.rpc('faxina_listar_acessos');
  const box=$('usuarios');box.replaceChildren();
  for(const user of users) {
    if(user.pessoa==='NAMOITA')continue;
    const row=F.element('div',null,'access-row');
    const text=F.element('div');text.append(F.element('strong',user.pessoa),F.element('p',user.cadastrada?'Senha cadastrada':user.convite_ativo?'Código liberado; aguardando cadastro':'Acesso não liberado','muted'));
    row.append(text);
    if(!user.cadastrada) {
      const btn=F.element('button',user.convite_ativo?'Gerar novo código':'Liberar acesso');btn.type='button';
      btn.onclick=async()=>{
        btn.disabled=true;
        try {
          const code=await F.rpc('faxina_liberar_acesso',{p_pessoa:user.pessoa});
          $('codigoGerado').textContent=`${user.pessoa}: ${code}`;$('conviteGerado').hidden=false;
          $('codigoGerado').dataset.code=code;$('adminStatus').textContent='Acesso liberado. Um novo código invalida o anterior.';
          await carregarAcessos();
        }catch(e){$('adminStatus').textContent=F.errorMessage(e);btn.disabled=false;}
      };
      row.append(btn);
    }
    box.append(row);
  }
}
async function carregar(profile) {
  dados=await F.rpc('faxina_listar');
  try{publicadas=await F.escalasPublicadas();}catch(e){$('appStatus').textContent=F.errorMessage(e);}
  atualizarSemanas();renderTasks();
  if(profile.is_admin)await carregarAcessos();
}
function semanaAtual() {
  const partes=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const valor=t=>partes.find(p=>p.type===t).value;
  const d=new Date(valor('year')+'-'+valor('month')+'-'+valor('day')+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()-d.getUTCDay());return d.toISOString().slice(0,10);
}
function atualizarSemanas() {
  const seletor=$('filtroSemana'), anterior=seletor.value;
  const semanas=[...new Set([...dados.map(t=>t.semana),...Object.keys(publicadas).filter(s=>s>='2026-09-27')])].sort().reverse();
  seletor.replaceChildren(F.element('option','Todas as semanas'));seletor.firstChild.value='';
  for(const semana of semanas){const option=F.element('option','Semana de '+F.day(semana));option.value=semana;seletor.append(option);}
  if(seguirSemanaAtual){const atual=semanaAtual();seletor.value=semanas.includes(atual)?atual:semanas.find(s=>s<=atual)||semanas[0]||'';}
  else seletor.value=semanas.includes(anterior)?anterior:'';
}
$('filtroSemana').onchange=()=>{seguirSemanaAtual=false;renderTasks();};
$('sincronizarEscala').onclick=async()=>{
  const btn=$('sincronizarEscala');btn.disabled=true;$('appStatus').textContent='Buscando a escala mais recente…';
  try{
    await F.rpc('faxina_sincronizar_agora');await carregar(F.profile);
    $('appStatus').textContent='Consulta atualizada. Confira a semana selecionada.';
  }catch(e){
    $('appStatus').textContent=/schema cache|Could not find|does not exist/i.test(String(e.message))?'A correção de sincronização do servidor ainda precisa ser aplicada. Consulte o guia desta atualização.':F.errorMessage(e);
  }finally{btn.disabled=false;}
};
$('copiarCodigo').onclick=async()=>{
  try {await navigator.clipboard.writeText($('codigoGerado').dataset.code);$('adminStatus').textContent='Código copiado.';}
  catch{$('adminStatus').textContent='Selecione o código acima e copie manualmente.';}
};
F.start(carregar);

