'use strict';
window.Faxinas = (() => {
  const $ = id => document.getElementById(id);
  const names = ['JUKEBOX','LOTERYA','KOMIXÃO','NAMOITA','NAZARÉ','CAMILA','BAQUETADA','AMANDA','BELA'];
  const emails = Object.fromEntries(names.map(n => [n, n.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()+'@jessicmchdo.github.io']));
  let sb, profile, refreshing = false;
  const money = n => Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const day = iso => new Date(iso.slice(0,10)+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'UTC'});
  const deadline = iso => new Date(iso).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
  const element = (tag, text, cls) => { const el=document.createElement(tag); if(text!=null)el.textContent=text; if(cls)el.className=cls; return el; };
  function errorMessage(error) {
    const message=String(error?.message||error||'');
    if (/Invalid login credentials/i.test(message)) return 'Nome ou senha incorretos. No primeiro acesso, use o código liberado por NAMOITA para cadastrar sua senha.';
    if (/Email not confirmed/i.test(message)) return 'O cadastro depende da configuração inicial. Peça a NAMOITA para verificar a ativação das contas.';
    if (/Database error saving new user/i.test(message)) return 'Cadastro não autorizado. Confira seu nome e o código de liberação com NAMOITA; o código pode estar incorreto, vencido ou já ter sido usado.';
    if (/already registered/i.test(message)) return 'Este nome já tem senha cadastrada. Use Entrar.';
    if (/fetch|network|Failed to fetch/i.test(message)) return 'Não foi possível conectar. Confira sua conexão e tente novamente.';
    if (/schema cache|does not exist|Could not find/i.test(message)) return 'A configuração do sistema ainda precisa ser ativada. Peça a NAMOITA para seguir o arquivo LEIA-ME-ATIVACAO.md.';
    return message || 'Não foi possível concluir a operação.';
  }
  async function rpc(name,args={}) {
    const {data,error}=await sb.rpc(name,args); if(error)throw error; return data;
  }
  async function perfil() {
    const {data:{user},error}=await sb.auth.getUser();
    if(error && error.name!=='AuthSessionMissingError' && error.status!==401)throw error;
    if(!user) {profile=null;return null;}
    const {data,error:err}=await sb.from('faxina_perfis').select('user_id,pessoa').eq('user_id',user.id).maybeSingle();
    if(err)throw err;
    if(!data)throw new Error('Seu acesso ainda não foi liberado. Procure NAMOITA.');
    profile={...data,is_admin:data.pessoa==='NAMOITA'};return profile;
  }
  async function start(render) {
    const update=async()=>{
      if(refreshing)return;
      refreshing=true;
      try {
        await perfil();
        $('loginCard').hidden=!!profile; $('appCard').hidden=!profile;
        if($('adminCard'))$('adminCard').hidden=!(profile?.is_admin);
        if(profile) {
          $('adminFiltro').hidden=!profile.is_admin;
          $('saudacao').textContent=profile.is_admin?'Olá, NAMOITA':`Olá, ${profile.pessoa}`;
          await render(profile);
        }
      } finally { refreshing=false; }
    };
    const showError=e=>{ (profile?$('appStatus'):$('loginStatus')).textContent=errorMessage(e); };
    $('retry').onclick=()=>{location.reload();};
    try {
      const config=window.APP_CONFIG;
      if(!window.supabase || !config?.SUPABASE_URL?.startsWith('https://') || !config.SUPABASE_ANON_KEY || config.SUPABASE_ANON_KEY.includes('COLE_AQUI'))throw new Error('A configuração de acesso está incompleta. Peça a NAMOITA para verificar a ativação.');
      sb=window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY,{auth:{storageKey:'faxinas-auth-v2',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      $('loginForm').onsubmit=async e=>{
        e.preventDefault(); $('entrar').disabled=true; $('loginStatus').textContent='Entrando…';
        try {
          const email=emails[$('pessoa').value];if(!email)throw new Error('Selecione seu nome.');
          const {error}=await sb.auth.signInWithPassword({email,password:$('senha').value});
          if(error)throw error;
          $('senha').value='';$('loginStatus').textContent='';await update();
        }catch(err){showError(err);}finally{$('entrar').disabled=false;}
      };
      $('signupForm').onsubmit=async e=>{
        e.preventDefault();$('cadastrar').disabled=true;$('loginStatus').textContent='Cadastrando…';
        try {
          const pessoa=$('pessoa').value;
          if(!emails[pessoa])throw new Error('Selecione seu nome acima.');
          if(pessoa==='NAMOITA')throw new Error('O acesso inicial de NAMOITA deve ser criado no painel do Supabase.');
          if($('novaSenha').value.length<8)throw new Error('Use uma senha com pelo menos 8 caracteres.');
          if($('novaSenha').value!==$('confirmarSenha').value)throw new Error('As senhas não coincidem.');
          const {data,error}=await sb.auth.signUp({email:emails[pessoa],password:$('novaSenha').value,options:{data:{codigo_liberacao:$('codigo').value.trim()}}});
          if(error)throw error;
          if(!data.session)throw new Error('O cadastro não foi ativado. NAMOITA precisa verificar a configuração de confirmação por e-mail e se a conta já existe.');
          $('signupForm').reset();$('loginStatus').textContent='';await update();
        }catch(err){showError(err);}finally{$('cadastrar').disabled=false;}
      };
      $('sair').onclick=async()=>{
        const {error}=await sb.auth.signOut();if(error){showError(error);return;}
        profile=null;$('appCard').hidden=true;$('loginCard').hidden=false;
        if($('adminCard'))$('adminCard').hidden=true;
        $('senha').value='';$('loginStatus').textContent='';
      };
      $('atualizar').onclick=()=>update().catch(showError);
      // O servidor define prazo e multas; o relógio do navegador apenas aciona a atualização.
      setInterval(()=>{if(profile && !document.hidden)update().catch(showError);},30000);
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)update().catch(showError);});
      await update();
    }catch(e){showError(e);$('retry').hidden=false;}
  }
  return {$,names,money,day,deadline,element,rpc,start,errorMessage,get profile(){return profile;}};
})();
