(()=>{"use strict";
const cfg=window.FUEL_THE_FIRE_CONFIG||{};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY){console.error("Fuel the Fire employee controls: Supabase configuration is missing.");return}
const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const $=s=>document.querySelector(s);
async function render(){
 const root=$("#page-content");
 if(!root||$("#page-title")?.textContent!=="Employees")return;
 try{
  const {data:{session},error:sessionError}=await db.auth.getSession();
  if(sessionError)throw sessionError;
  if(!session)return;
  const me=await db.from("profiles").select("role,active").eq("id",session.user.id).maybeSingle();
  if(me.error)throw me.error;
  if(me.data?.role!=="admin")return;
  const tableEl=root.querySelector("table");
  if(!tableEl)return;
  const head=tableEl.querySelector("thead tr");
  if(head&&!head.querySelector('[data-employee-actions-head]')){const th=document.createElement("th");th.dataset.employeeActionsHead="1";th.textContent="Account actions";head.appendChild(th)}
  const body=tableEl.querySelector("tbody");
  if(!body)return;
  body.querySelectorAll('[data-employee-actions-cell]').forEach(td=>td.parentElement.removeChild(td));
  const r=await db.from("profiles").select("id,full_name,email,role,active").neq("role","admin").order("full_name");
  if(r.error)throw r.error;
  const rows=r.data||[];
  const trs=[...body.querySelectorAll("tr")].filter(tr=>tr.children.length>1);
  rows.forEach((employee,index)=>{
   const tr=trs[index];if(!tr)return;
   const td=document.createElement("td");td.dataset.employeeActionsCell="1";
   td.innerHTML='<div class="inline-actions"><button type="button" class="secondary" data-act="toggle" data-id="'+esc(employee.id)+'" data-active="'+(employee.active?"1":"0")+'">'+(employee.active?"Deactivate":"Activate")+'</button> <button type="button" class="secondary" data-act="delete" data-id="'+esc(employee.id)+'">Delete</button></div>';
   tr.appendChild(td);
  });
  body.querySelectorAll('[data-act="toggle"]').forEach(b=>b.onclick=async()=>{const active=b.dataset.active!=="1";if(!confirm((active?"Activate":"Deactivate")+" this employee account?"))return;b.disabled=true;try{const x=await db.functions.invoke("admin-manage-user",{body:{action:"set_active",user_id:b.dataset.id,active}});if(x.error)throw x.error;if(x.data?.error)throw Error(x.data.error);await render()}catch(e){alert(e.message||"Could not update account.");b.disabled=false}});
  body.querySelectorAll('[data-act="delete"]').forEach(b=>b.onclick=async()=>{const name=b.closest("tr")?.querySelector("strong")?.textContent||"this employee";if(!confirm("Permanently delete "+name+"'s account? This cannot be undone."))return;b.disabled=true;try{const x=await db.functions.invoke("admin-manage-user",{body:{action:"delete",user_id:b.dataset.id}});if(x.error)throw x.error;if(x.data?.error)throw Error(x.data.error);await render()}catch(e){alert(e.message||"Could not delete account.");b.disabled=false}});
 }catch(e){console.error("Fuel the Fire employee controls failed:",e)}
}
function hook(){const nav=$("#main-nav");if(nav)nav.addEventListener("click",e=>{if(e.target.closest('[data-page="employees"]'))setTimeout(render,350)});window.addEventListener("fuel-employee-updated",()=>setTimeout(render,0));window.FuelEmployeeAdmin={render};if($("#page-title")?.textContent==="Employees")setTimeout(render,350)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",hook);else hook();
})();