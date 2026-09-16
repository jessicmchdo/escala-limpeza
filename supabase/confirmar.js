const sb = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);
const ATIVACAO = "2026-09-20";
const $ = id => document.getElementById(id);
let pessoaAtual = sessionStorage.getItem("pessoa_escala") || "";

function prazo(semana, bloco) {
  const d = new Date(`${semana}T12:00:00-03:00`);
  const domingo = new Date(d);
  domingo.setDate(d.getDate() - d.getDay());
  const limite = new Date(domingo);
  limite.setDate(domingo.getDate() + (bloco === "DOM/SEG/TER" ? 2 : 6));
  limite.setHours(23,59,59,999);
  return limite;
}

async function carregar() {
  if (!pessoaAtual) {
    $("loginCard").hidden = false; $("appCard").hidden = true; return;
  }
  $("loginCard").hidden = true; $("appCard").hidden = false;
  $("saudacao").textContent = `Faxinas de ${pessoaAtual}`;

  const [{data: atrib, error:e1}, {data: conf, error:e2}] = await Promise.all([
    sb.from("atribuicoes").select("*").eq("pessoa", pessoaAtual).gte("semana", ATIVACAO).order("semana"),
    sb.from("confirmacoes").select("*").eq("pessoa", pessoaAtual).gte("semana", ATIVACAO)
  ]);
  if(e1) throw e1; if(e2) throw e2;

  const feitas = new Set((conf||[]).map(x => `${x.semana}|${x.bloco}`));
  const tarefas = (atrib||[]).filter(x => !["FOLGA","AUSENTE"].includes(String(x.tarefa).toUpperCase()));
  const box = $("tarefas"); box.innerHTML = "";

  if(!tarefas.length) {
    box.innerHTML = '<p class="muted">Nenhuma faxina disponível no momento.</p>'; return;
  }

  for(const a of tarefas) {
    const feita = feitas.has(`${a.semana}|${a.bloco}`);
    const limite = prazo(a.semana,a.bloco);
    const vencida = new Date() > limite;
    const card = document.createElement("article");
    card.className = "task-card";
    card.innerHTML = `<h3>${a.tarefa}</h3>
      <p><span class="badge">${a.bloco}</span> Semana de ${a.semana}</p>
      <p>Prazo: ${limite.toLocaleString("pt-BR")}</p>`;
    const btn = document.createElement("button");

    if(feita) {
      btn.textContent = "✓ Faxina confirmada"; btn.disabled = true;
    } else if(vencida) {
      btn.textContent = "Prazo encerrado"; btn.disabled = true;
    } else {
      btn.textContent = "Marcar como feita";
      btn.onclick = async () => {
        btn.disabled = true;
        const {error} = await sb.rpc("confirmar_faxina", {
          p_pessoa: pessoaAtual,
          p_semana: a.semana,
          p_bloco: a.bloco,
          p_tarefa: a.tarefa
        });
        if(error) { $("appStatus").textContent=error.message; btn.disabled=false; }
        else carregar();
      };
    }
    card.appendChild(btn); box.appendChild(card);
  }
}

$("entrar").onclick = () => {
  pessoaAtual = $("pessoa").value;
  if(!pessoaAtual){$("loginStatus").textContent="Selecione seu nome.";return;}
  sessionStorage.setItem("pessoa_escala",pessoaAtual);
  carregar().catch(e=>$("appStatus").textContent=e.message);
};
$("sair").onclick = () => {
  sessionStorage.removeItem("pessoa_escala"); pessoaAtual=""; carregar();
};
carregar().catch(e=>$("appStatus").textContent=e.message);
