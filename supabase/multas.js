const sb=window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL,window.APP_CONFIG.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
async function carregar(){
  let q=sb.from("multas").select("*").gte("semana","2026-09-20").order("semana",{ascending:false});
  if($("pessoa").value) q=q.eq("pessoa",$("pessoa").value);
  const {data,error}=await q;
  if(error){$("status").textContent=error.message;return;}
  const box=$("listaMultas");box.innerHTML="";
  if(!(data||[]).length){box.innerHTML='<p class="muted">Nenhuma multa encontrada.</p>';return;}
  for(const m of data){
    const el=document.createElement("article");el.className="fine-card";
    el.innerHTML=`<h3>${m.pessoa} — R$ ${Number(m.valor).toFixed(2).replace(".",",")}</h3><p>${m.tarefa} • ${m.bloco} • semana ${m.semana}</p><p><span class="badge">${m.status}</span></p>`;
    box.appendChild(el);
  }
}
$("consultar").onclick=carregar;carregar();
