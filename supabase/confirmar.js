'use strict';
const F=window.Faxinas, $=F.$;
let dados=[];
function renderTasks() {
  const box=$('tarefas');box.replaceChildren();
  const filtro=F.profile.is_admin?$('filtroPessoa').value:F.profile.pessoa;
  const tasks=dados.filter(t=>!filtro || t.pessoa===filtro);
  if(!tasks.length){box.append(F.element('p','Nenhuma faxina disponível para esta pessoa.','muted'));return;}
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
  dados=await F.rpc('faxina_listar');renderTasks();
  if(profile.is_admin)await carregarAcessos();
}
$('filtroPessoa').onchange=renderTasks;
$('copiarCodigo').onclick=async()=>{
  try {await navigator.clipboard.writeText($('codigoGerado').dataset.code);$('adminStatus').textContent='Código copiado.';}
  catch{$('adminStatus').textContent='Selecione o código acima e copie manualmente.';}
};
F.start(carregar);
