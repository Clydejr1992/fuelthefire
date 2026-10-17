(()=>{"use strict";
const cfg=window.FUEL_THE_FIRE_CONFIG||{};
const esc=v=>String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#39;"}[c]));
if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const $=s=>document.querySelector(s);
async function render(){
 const root=$("#page-content"); if(!root)return;
 const {data:{session}}=await db.auth.getSession(); if(!session)return;
 const me=await db.from("profiles").select("role,active").eq("id",session.user.id).maybeSingle();
 if(me.error||me.data?.role!=="admin")return;
 const r=await db.from("profiles").select("id,full_name,email,role,active,employee_number,department,must_change_password").neq("role","admin").order("full_name");
 if(r.error){root.insertAdjacentHTML("afterbegin",`<div class=\"panel error-box\">${esc(r.error.message)}</div>`);return}
 const rows=r.data||[];
 root.innerHTML='<div class="panel"><div class="panel-head"><div><h2>Employee accounts</h2><p class="small">Activate, deactivate, or permanently delete employee accounts. Historical accounts should normally be deactivated so records remain intact.</p></div></div><div class="table-wrap"><table><thead><tr><th>Employee</th><th>Employee #</th><th>Department</th><th>Role</th><th>Status</th><th>Password setup</th><th>Account actions</th></tr></thead><tbody>'+
 (rows.length?rows.map(e=>`<tr><td><strong>${esc(e.full_name||"Unnamed")}</strong><div class="subtle">${esc(e.email||"")}</div></td><td>${esc(e.employee_number||"—")}</td><td>${esc(e.department||"—")}</td><td>${esc(e.role)}</td><td><span class="pill ${e.active?"":"out"}">${e.active?"Active":"Inactive"}</span></td><td>${e.must_change_password?"Must change":"Set up"}</td><td><div class="inline-actions"><button class="secondary" data-act="toggle" data-id="${esc(e.id)}" data-active="${e.active?"1":"0"}">${e.active?"Deactivate":"Activate"}</button><button class="secondary" data-act="delete" data-id="${esc(e.id)}">Delete</button></div></td></tr>`).join(""):'<tr><td colspan="7" class="empty">No employee accounts found.</td></tr>')+'</tbody></table></div></div>';
 root.querySelectorAll('[data-act="toggle"]').forEach(b=>b.onclick=async()=>{const active=b.dataset.active!=="1";b.disabled=true;try{const x=await db.functions.invoke("admin-manage-user",{body:{action:"set_active",user_id:b.dataset.id,active}});if(x.error)throw x.error;if(x.data?.error)throw Error(x.data.error);await render();window.dispatchEvent(new CustomEvent("fuel-employee-updated"));}catch(e){alert(e.message||"Could not update account.");b.disabled=false}});
 root.querySelectorAll('[data-act="delete"]').forEach(b=>b.onclick=async()=>{const row=b.closest("tr");const name=row?.querySelector("strong")?.textContent||"this employee";if(!confirm(`Permanently delete ${name}'s account?\n\nThis cannot be undone. If the employee has historical records, the system will refuse the deletion and you can deactivate the account instead.`))return;b.disabled=true;try{const x=await db.functions.invoke("admin-manage-user",{body:{action:"delete",user_id:b.dataset.id}});if(x.error)throw x.error;if(x.data?.error)throw Error(x.data.error);await render();window.dispatchEvent(new CustomEvent("fuel-employee-updated"));}catch(e){alert(e.message||"Could not delete account.");b.disabled=false}});
}
function hook(){const nav=$("#main-nav");if(!nav)return;nav.addEventListener("click",e=>{const b=e.target.closest('[data-page="employees"]');if(!b)return;setTimeout(()=>{if($("#page-title")?.textContent==="Employees")render()},150)});window.addEventListener("fuel-employee-updated",()=>{if($("#page-title")?.textContent==="Employees")render()})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",hook);else hook();
window.FuelEmployeeAdmin={render};
})();
