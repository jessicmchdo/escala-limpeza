const cfg = window.APP_CONFIG;
const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

async function perfil() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data, error } = await sb.from("profiles").select("id,nome,admin").eq("id", user.id).single();
  if (error) throw error;
  return data;
}

async function carregar() {
  const p = await perfil();
  if (!p) { $("loginCard").hidden=false; $("appCard").hidden=true; return; }
  $("loginCard").hidden=true; $("appCard").hidden=false;
  $("titulo").textContent = p.admin ? "Todas as multas" : "Minhas multas";
  $("perfilInfo").textContent = p.admin ? `Administrador: ${p.nome}` : p.nome;

  let q = sb.from("multas").select("*").gte("semana","2026-09-20").order("semana",{ascending:false});
  if (!p.admin) q = q.eq("pessoa",p.nome);
  const {data,error}=await q;
  if(error) throw error;

  const box=$("listaMultas"); box.innerHTML="";
  if(!(data||[]).length){box.innerHTML='<p class="muted">Nenhuma multa encontrada.</p>';return;}
  for(const m of data){
    const el=document.createElement("article"); el.className="fine-card";
    el.innerHTML=`<h3>${m.pessoa} — R$ ${Number(m.valor).toFixed(2).replace(".",",")}</h3>
      <p>${m.tarefa} • ${m.bloco} • semana ${m.semana}</p>
      <p><span class="badge">${m.status}</span></p>`;
    if(p.admin){
      const btn=document.createElement("button");
      btn.textContent=m.status==="PAGO"?"Marcar como pendente":"Marcar como pago";
      btn.onclick=async()=>{
        const novo=m.status==="PAGO"?"PENDENTE":"PAGO";
        const {error}=await sb.from("multas").update({
          status:novo, paga_em:novo==="PAGO"?new Date().toISOString():null
        }).eq("id",m.id);
        if(error)$("appStatus").textContent=error.message; else carregar();
      };
      el.appendChild(btn);
    }
    box.appendChild(el);
  }
}
$("entrar").onclick=async()=>{
  $("loginStatus").textContent="Entrando...";
  const {error}=await sb.auth.signInWithPassword({email:$("email").value.trim(),password:$("senha").value});
  $("loginStatus").textContent=error?error.message:"";
  if(!error)carregar();
};
$("sair").onclick=async()=>{await sb.auth.signOut();carregar();};
sb.auth.onAuthStateChange(()=>setTimeout(carregar,0));
carregar().catch(e=>$("appStatus").textContent=e.message);
