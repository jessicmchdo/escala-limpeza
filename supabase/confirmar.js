const cfg = window.APP_CONFIG;
const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
const ATIVACAO = "2026-09-20";

const $ = (id) => document.getElementById(id);
const loginCard = $("loginCard"), appCard = $("appCard");

function prazo(semana, bloco) {
  const d = new Date(`${semana}T12:00:00-03:00`);
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  const deadline = new Date(sunday);
  if (bloco === "DOM/SEG/TER") {
    deadline.setDate(sunday.getDate() + 2);
  } else {
    deadline.setDate(sunday.getDate() + 6);
  }
  deadline.setHours(23,59,59,999);
  return deadline;
}

async function perfil() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data, error } = await sb.from("profiles").select("id,nome,admin").eq("id", user.id).single();
  if (error) throw error;
  return data;
}

async function carregar() {
  const p = await perfil();
  if (!p) {
    loginCard.hidden = false; appCard.hidden = true; return;
  }
  loginCard.hidden = true; appCard.hidden = false;
  $("saudacao").textContent = `Faxinas de ${p.nome}`;

  const [{data: atrib, error: e1}, {data: conf, error: e2}] = await Promise.all([
    sb.from("atribuicoes").select("*").eq("pessoa", p.nome).gte("semana", ATIVACAO).order("semana"),
    sb.from("confirmacoes").select("*").eq("pessoa", p.nome).gte("semana", ATIVACAO)
  ]);
  if (e1) throw e1; if (e2) throw e2;

  const feitas = new Set((conf||[]).map(x => `${x.semana}|${x.bloco}`));
  const validas = (atrib||[]).filter(x => !["FOLGA","AUSENTE"].includes(String(x.tarefa).toUpperCase()));
  const box = $("tarefas");
  box.innerHTML = "";
  if (!validas.length) {
    box.innerHTML = '<p class="muted">Nenhuma faxina disponível no momento.</p>'; return;
  }

  for (const a of validas) {
    const key = `${a.semana}|${a.bloco}`;
    const feita = feitas.has(key);
    const limite = prazo(a.semana, a.bloco);
    const vencida = new Date() > limite;
    const el = document.createElement("article");
    el.className = "task-card";
    el.innerHTML = `<h3>${a.tarefa}</h3>
      <p><span class="badge">${a.bloco}</span> Semana de ${a.semana}</p>
      <p>Prazo: ${limite.toLocaleString("pt-BR")}</p>`;
    const btn = document.createElement("button");
    if (feita) {
      btn.textContent = "✓ Faxina confirmada"; btn.disabled = true; btn.className = "done";
    } else if (vencida) {
      btn.textContent = "Prazo encerrado"; btn.disabled = true;
    } else {
      btn.textContent = "Marcar como feita";
      btn.onclick = async () => {
        btn.disabled = true;
        const { error } = await sb.from("confirmacoes").insert({
          user_id: p.id, pessoa: p.nome, semana: a.semana, bloco: a.bloco, tarefa: a.tarefa
        });
        if (error) { $("appStatus").textContent = error.message; btn.disabled = false; }
        else await carregar();
      };
    }
    el.appendChild(btn); box.appendChild(el);
  }
}

$("entrar").onclick = async () => {
  $("loginStatus").textContent = "Entrando...";
  const { error } = await sb.auth.signInWithPassword({email:$("email").value.trim(), password:$("senha").value});
  $("loginStatus").textContent = error ? error.message : "";
  if (!error) carregar();
};
$("sair").onclick = async () => { await sb.auth.signOut(); carregar(); };
sb.auth.onAuthStateChange(() => setTimeout(carregar,0));
carregar().catch(e => $("appStatus").textContent = e.message);
