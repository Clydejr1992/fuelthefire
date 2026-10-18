(()=>{"use strict";
const cfg=window.FUEL_THE_FIRE_CONFIG||{};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY){console.error("Fuel the Fire employee controls: Supabase configuration is missing.");return}
const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const $=s=>document.querySelector(s);
let rendering=false;
async function render(){
 const root=$("#page-content");
 if(rendering||!root||$("#page-title")?.textContent!=="Employees")return;
 const tableEl=root.querySelector("table");
 if(!tableEl)return;
 rendering=true;
 try{
  const {data:{session},error:sessionError}=await db.auth.getSession();
  if(sessionError)throw sessionError;
  if(!session)return;
  const me=await db.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
  if(me.error)throw me.error;
  if(me.data?.role!=="admin")return;
  const currentTable=root.querySelector("table");
  if(!currentTable||currentTable!==tableEl)return;
  const body=currentTable.querySelector("tbody"),head=currentTable.querySelector("thead tr");
  if(!body||!head)return;
  // Remove any previous action column/cells before adding a single fresh set.
  head.querySelectorAll('[data-employee-actions-head]').forEach(el=>el.remove());
  body.querySelectorAll('[data-employee-actions-cell]').forEach(el=>el.remove());
  // Clean up duplicates left by older cached versions of this script.
  [...head.children].filter(th=>th.textContent.trim()==="Account actions").forEach(el=>el.remove());
  [...body.querySelectorAll("tr")].forEach(tr=>[...tr.children].filter(td=>td.dataset.employeeActionsCell==="1"||td.textContent.includes("Deactivate")&&td.textContent.includes("Delete")&&td.querySelector("button[data-act]")).forEach(td=>td.remove()));
  const r=await db.from("profiles").select("id,full_name,email,role,active").neq("role","admin").order("full_name");
  if(r.error)throw r.error;
  if($("#page-title")?.textContent!=="Employees"||root!==$("#page-content")||currentTable!==root.querySelector("table"))return;
  const employees=r.data||[];
  const trs=[...body.querySelectorAll("tr")].filter(tr=>tr.children.length>1&&!tr.querySelector(".empty"));
  const th=document.createElement("th");th.dataset.employeeActionsHead="1";th.textContent="Account actions";head.appendChild(th);
  employees.forEach(employee=>{
   // Match the employee row by email instead of assuming database and UI ordering match.
   const tr=trs.find(row=>row.textContent.includes(employee.email||"\u0000"));
   if(!tr)return;
   const td=document.createElement("td");td.dataset.employeeActionsCell="1";
   td.innerHTML='<div class="inline-actions"><button type="button" class="secondary" data-act="toggle" data-id="'+esc(employee.id)+'" data-active="'+(employee.active?"1":"0")+'">'+(employee.active?"Deactivate":"Activate")+'</button> <button type="button" class="secondary" data-act="delete" data-id="'+esc(employee.id)+'">Delete</button></div>';
   tr.appendChild(td);
  });
  body.querySelectorAll('[data-act="toggle"]').forEach(b=>b.onclick=async()=>{const active=b.dataset.active!=="1";if(!confirm((active?"Activate":"Deactivate")+" this employee account?"))return;b.disabled=true;try{const x=await db.functions.invoke("admin-manage-user",{body:{action:"set_active",user_id:b.dataset.id,active}});if(x.error)throw x.error;if(x.data?.error)throw Error(x.data.error);const statusResult=await db.from("profiles").select("active").eq("id",b.dataset.id).maybeSingle();if(statusResult.error)throw statusResult.error;if(!statusResult.data)throw Error("Account status could not be verified.");const row=b.closest("tr"),statusCell=row?.children[4];if(statusCell){const isActive=statusResult.data.active===true;statusCell.innerHTML='<span class="pill '+(isActive?"":"out")+'">'+(isActive?"Active":"Inactive")+"</span>"}if(window.FuelEmployeeAdmin)window.FuelEmployeeAdmin.render()}catch(e){alert(e.message||"Could not update account.");b.disabled=false}});
  body.querySelectorAll('[data-act="delete"]').forEach(b=>b.onclick=async()=>{const name=b.closest("tr")?.querySelector("strong")?.textContent||"this employee";if(!confirm("Permanently delete "+name+"'s account? This cannot be undone."))return;b.disabled=true;try{const x=await db.functions.invoke("admin-manage-user",{body:{action:"delete",user_id:b.dataset.id}});if(x.error)throw x.error;if(x.data?.error)throw Error(x.data.error);if(window.FuelEmployeeAdmin)window.FuelEmployeeAdmin.render()}catch(e){alert(e.message||"Could not delete account.");b.disabled=false}});
 }catch(e){console.error("Fuel the Fire employee controls failed:",e)}finally{rendering=false}
}
function hook(){window.FuelEmployeeAdmin={render};if($("#page-title")?.textContent==="Employees")setTimeout(render,350)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",hook);else hook();
})();