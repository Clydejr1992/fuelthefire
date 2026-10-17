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
  if(!session){root.insertAdjacentHTML("afterbegin",'<div class="panel error-box">Please sign in again to manage employee accounts.</div>');return}
  const me=await db.from("profiles").select("role,active").eq("id",session.user.id).maybeSingle();
  if(me.error)throw me.error;
  if(me.data?.role!=="admin"){
   root.insertAdjacentHTML("afterbegin",'<div class="panel error-box">Delete and Activate/Deactivate controls are available to administrator accounts only. Your current role is '+esc(me.data?.role||"unknown")+'.</div>');
   return;
  }
  const r=await db.from("profiles").select("id,full_name,email,role,active,employee_number,department,must_change_password").neq("role","admin").order("full_name");
  if(r.error)throw r.error;
  const rows=r.data||[];
  root.innerHTML='<div class="panel"><div class="panel-head"><div><h2>Employee accounts</h2><p class="small">Activate, deactivate, or permanently delete employee accounts. Historical inventory, assignment, and meal-report records are intended to be preserved.</p></div></div><div class="table-wrap"><table><thead><tr><th>Employee</th><th>Employee #</th><th>Department</th><th>Role</th><th>Status</th><th>Password setup</th><th>Account actions</th></tr></thead><tbody>'+
   (rows.length?rows.map(e=>'<tr><td><strong>'+esc(e.full_name||"Unnamed")+'</strong><div class="subtle">'+esc(e.email||"")+'</div></td><td>'+esc(e.employee_number||"—")+'</td><td>'+esc(e.department||"—")+'</td><td>'+esc(e.role)+'</td><td><span class="pill '+(e.active?"":"out")+'">'+(e.active?"Active":"Inactive")+'</span></td><td>'+(e.must_change_password?"Must change":"Set up")+'</td><td><div class="inline-actions"><button type="button" class="secondary" data-act="toggle" data-id="'+esc(e.id)+'" data-active="'+(e.active?"1":"0")+'">'+(e.active?"Deactivate":"Activate")+'</button> <button type="button" class="secondary" data-act="delete" data-id="'+esc(e.id)+'">Delete</button></div></td></tr>').join(""):'<tr><td colspan="7" class="empty">No employee accounts found.</td></tr>')+'</tbody></table></div></div>';
  root.querySelectorAll('[data-act="toggle"]').forEach(b=>b.onclick=async()=>{
   const active=b.dataset.active!=="1";
   if(!confirm((active?"Activate":"Deactivate")+" this employee account?"))return;
   b.disabled=true;
   try{const x=await db.functions.invoke("admin-manage-user",{body:{action:"set_active",user_id:b.dataset.id,active}});if(x.error)throw x.error;if(x.data?.error)throw Error(x.data.error);await render()}catch(e){alert(e.message||"Could not update account.");b.disabled=false}
  });
  root.querySelectorAll('[data-act="delete"]').forEach(b=>b.onclick=async()=>{
   const name=b.closest("tr")?.querySelector("strong")?.textContent||"this employee";
   if(!confirm('Permanently delete '+name+"'s account? This cannot be undone."))return;
   b.disabled=true;
   try{const x=await db.functions.invoke("admin-manage-user",{body:{action:"delete",user_id:b.dataset.id}});if(x.error)throw x.error;if(x.data?.error)throw Error(x.data.error);await render()}catch(e){alert(e.message||"Could not delete account.");b.disabled=false}
  });
 }catch(e){
  console.error("Fuel the Fire employee controls failed:",e);
  root.insertAdjacentHTML("afterbegin",'<div class="panel error-box">Employee account controls could not load: '+esc(e.message||e)+'.</div>');
 }
}
function hook(){
 const nav=$("#main-nav");
 if(nav)nav.addEventListener("click",e=>{if(e.target.closest('[data-page="employees"]'))setTimeout(render,250)});
 window.addEventListener("fuel-employee-updated",()=>setTimeout(render,0));
 window.FuelEmployeeAdmin={render};
 if($("#page-title")?.textContent==="Employees")render();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",hook);else hook();
})();