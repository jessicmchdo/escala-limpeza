// Executar com Playwright instalado. Inicia servidor local automaticamente.
// Respostas simuladas: não acessa nem grava o banco real.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
let base=process.env.FAXINAS_BASE_URL;
let localServer;
const mock=()=>{
 const $state=()=>localStorage.getItem('smoke-user');
 const fixtures=[
 {id:1,pessoa:'JUKEBOX',semana:'2026-09-27',bloco:'dom_seg_ter',tarefa:'Sala e copa',estado:'nao_concluida',estado_efetivo:'nao_concluida',vencida:true,prazo:'2026-09-30T02:59:59.999Z',dia_vencimento:'2026-09-29',valor_multa:30},
 {id:2,pessoa:'JUKEBOX',semana:'2026-09-27',bloco:'qui_sex_sab',tarefa:'Cozinha',estado:'nao_concluida',estado_efetivo:'nao_concluida',vencida:true,prazo:'2026-10-04T02:59:59.999Z',dia_vencimento:'2026-10-03',valor_multa:30},
 {id:3,pessoa:'JUKEBOX',semana:'2026-10-04',bloco:'dom_seg_ter',tarefa:'Panos',estado:'pendente',estado_efetivo:'pendente',vencida:false,prazo:'2026-10-07T02:59:59.999Z',dia_vencimento:'2026-10-06',valor_multa:0},
 {id:4,pessoa:'CAMILA',semana:'2026-09-27',bloco:'dom_seg_ter',tarefa:'Geladeira',estado:'nao_concluida',estado_efetivo:'nao_concluida',vencida:true,prazo:'2026-09-30T02:59:59.999Z',dia_vencimento:'2026-09-29',valor_multa:30}];
 let invalid=false;
 window.supabase={createClient:()=>({
 auth:{getUser:async()=>({data:{user:$state()?{id:$state()}:null},error:null}),
 signInWithPassword:async({email,password})=>{
  if(password!=='senha123')return {error:{message:'Invalid login credentials'}};
  localStorage.setItem('smoke-user',email.startsWith('namoita')?'NAMOITA':'JUKEBOX');return {data:{session:{}},error:null};},
 signUp:async({options})=>options.data.codigo_liberacao==='liberado'? (localStorage.setItem('smoke-user','JUKEBOX'),{data:{session:{}},error:null}):{error:{message:'Database error saving new user'}},
 signOut:async()=>{localStorage.removeItem('smoke-user');return {error:null};}},
 from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:$state()?{user_id:$state(),pessoa:$state()}:null,error:null})})})}),
 rpc:async(name,args)=>{
  if(invalid)return {error:{message:'Failed to fetch'}};
  if(name==='faxina_listar')return {data:fixtures.filter(x=>$state()==='NAMOITA'||x.pessoa===$state()),error:null};
  if(name==='faxina_marcar'){const t=fixtures.find(x=>x.id===args.p_id);t.estado=args.p_estado;t.estado_efetivo=args.p_estado;t.valor_multa=t.vencida && args.p_estado==='nao_concluida'?30:0;return {data:null,error:null};}
  if(name==='faxina_listar_acessos')return {data:[{pessoa:'JUKEBOX',cadastrada:true},{pessoa:'CAMILA',cadastrada:false,convite_ativo:false}],error:null};
  if(name==='faxina_liberar_acesso')return {data:'codigo-individual-de-camila',error:null};
  return {error:{message:'RPC desconhecida'}};
 }})};
 window.simularFalha=()=>invalid=true;
};
(async()=>{
 if(!base){
  const fs=require('node:fs'),http=require('node:http');
  localServer=http.createServer((req,res)=>{
   const file=path.resolve(__dirname,'..','.'+new URL(req.url,'http://localhost').pathname);
   if(!file.startsWith(path.resolve(__dirname,'..')+path.sep)){res.writeHead(403).end();return;}
   if(!fs.existsSync(file)){res.writeHead(404).end();return;}
   res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');
   fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>localServer.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+localServer.address().port;
 }
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'application/javascript',body:`(${mock.toString()})();`}));
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function login(nome){await page.locator('#pessoa').selectOption(nome);await page.locator('#senha').fill('senha123');await page.locator('#entrar').click();await page.locator('#appCard').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelectorAll('.task-card,.fine-card').length>0);}
 await page.goto(base+'/supabase/confirmar.html');
 assert(await page.locator('#loginCard').isVisible());assert(await page.locator('#appCard').isHidden());
 await page.locator('#pessoa').selectOption('JUKEBOX');await page.locator('#senha').fill('errada123');await page.locator('#entrar').click();await page.waitForFunction(()=>document.querySelector('#loginStatus').textContent.includes('incorretos'));
 await login('JUKEBOX');assert.equal(await page.locator('.task-card').count(),3);assert(await page.locator('#adminCard').isHidden());
 assert.equal(await page.locator('.task-card.nao_concluida button').count(),0);
 await page.locator('.task-card.pendente button').filter({hasText:'Marcar como concluída'}).click();
 await page.waitForFunction(()=>document.querySelector('.task-card.concluida'));
 await page.screenshot({path:'/tmp/faxinas-desktop.png',fullPage:true});
 await page.goto(base+'/supabase/multas.html');await page.locator('.fine-card').first().waitFor();
 assert.equal(await page.locator('.fine-card').count(),2);assert.equal(await page.locator('.month-card').count(),2);
 assert(await page.locator('#adminFiltro').isHidden());
 await page.locator('#mes').selectOption('2026-09');assert.equal(await page.locator('.fine-card').count(),1);assert((await page.locator('#listaMultas').textContent()).includes('29/09/2026'));
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/faxinas-mobile.png',fullPage:true});
 await page.locator('#sair').click();assert(await page.locator('#appCard').isHidden());
 await page.goto(base+'/supabase/confirmar.html');await login('NAMOITA');await page.locator('#usuarios button').first().waitFor();assert(await page.locator('#adminCard').isVisible());
 await page.locator('#usuarios button').first().click();await page.locator('#conviteGerado').waitFor({state:'visible'});assert((await page.locator('#codigoGerado').textContent()).includes('CAMILA'));
 await page.locator('#filtroPessoa').selectOption('CAMILA');assert.equal(await page.locator('.task-card').count(),1);
 await page.locator('.task-card button').filter({hasText:'Marcar como concluída'}).click();await page.waitForFunction(()=>document.querySelector('.task-card.concluida'));assert.equal(await page.locator('.fine-value').count(),0);
 await page.evaluate(()=>window.simularFalha());await page.locator('#atualizar').click();await page.waitForFunction(()=>document.querySelector('#appStatus').textContent.includes('conectar'));
 await page.locator('#sair').click();
 await page.goto(base+'/supabase/multas.html');await page.locator('#pessoa').selectOption('JUKEBOX');await page.locator('#cadastro summary').click();
 await page.locator('#codigo').fill('errado');await page.locator('#novaSenha').fill('nova12345');await page.locator('#confirmarSenha').fill('outra12345');await page.locator('#cadastrar').click();await page.waitForFunction(()=>document.querySelector('#loginStatus').textContent.includes('não coincidem'));
 await page.locator('#confirmarSenha').fill('nova12345');await page.locator('#cadastrar').click();await page.waitForFunction(()=>document.querySelector('#loginStatus').textContent.includes('Cadastro não autorizado'));
 await page.locator('#codigo').fill('liberado');await page.locator('#cadastrar').click();await page.locator('#appCard').waitFor({state:'visible'});
 assert.deepEqual(errors,[]);await browser.close();if(localServer)localServer.close();console.log('PASS: login, cadastro, tarefas, prazos bloqueados, filtros mensais, NAMOITA, falha de rede e layout mobile.');
})().catch(e=>{console.error(e);process.exit(1);});
