(()=>{"use strict";
const cfg=window.FUEL_THE_FIRE_CONFIG||{},$=s=>document.querySelector(s);
if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY){location.replace("index.html");return}
const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const say=(s,bad=false)=>{const e=$("#cook-message");e.textContent=s;e.style.color=bad?"#b91c1c":"#166534"};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let user,profile,editingId=null,reportRows=[];
async function init(){
 const {data:{session}}=await db.auth.getSession();if(!session){location.replace("index.html");return}user=session.user;
 const {data:p,error}=await db.from("profiles").select("id,full_name,email,role,active,must_change_password").eq("id",user.id).maybeSingle();
 if(error||!p||p.active!==true){await db.auth.signOut();location.replace("index.html");return}profile=p;
 if(profile.role!=="cook"){say("This page is only for Cook accounts. Returning to the main app.",true);setTimeout(()=>location.replace("app.html"),900);return}
 $("#cook-identity").textContent=(profile.full_name||profile.email)+" • Cook";
 if(profile.must_change_password){say("Please finish password setup from the main app before using Cook reports.",true);location.replace("app.html");return}
 $("#cook-date").value=new Date().toLocaleDateString("en-CA");
 $("#cook-add-item").onclick=addItem;
 $("#cook-signout").onclick=async()=>{await db.auth.signOut();location.replace("index.html")};
 $("#cook-save-draft").onclick=saveDraft;$("#cook-submit").onclick=submitReport;
 $("#cook-new-report").onclick=resetForm;
 await loadAssignedSchools();await loadReports();if(!$("#cook-items tr:not(.cook-empty)").length)addItem();
}
async function loadAssignedSchools(){
 const sel=$("#cook-school");
 const {data,error}=await db.from("cook_school_assignments").select("school_id,schools(id,name,active)").eq("cook_id",user.id).is("revoked_at",null);
 if(error){sel.innerHTML='<option value="">School assignments unavailable</option>';say("School assignments could not be loaded. Check the database migration and permissions.",true);return}
 const rows=(data||[]).filter(a=>a.schools&&a.schools.active);
 sel.innerHTML='<option value="">Choose assigned school</option>'+rows.map(a=>'<option value="'+esc(a.school_id)+'">'+esc(a.schools.name)+'</option>').join("");
 if(!rows.length)say("No active school assignments yet. Ask an administrator to assign your schools.");
}
function itemRows(){return [...$("#cook-items").querySelectorAll("tr")].filter(tr=>tr.querySelector(".item-name")).map(tr=>({
 item_name:tr.querySelector(".item-name").value.trim(),category:tr.querySelector(".item-category").value.trim()||"Other",
 quantity_offered:Number(tr.querySelector(".item-offered").value),quantity_reused:Number(tr.querySelector(".item-reused").value),
 quantity_wasted:Number(tr.querySelector(".item-waste").value),unit_name:tr.querySelector(".item-unit").value.trim()||"servings",product_id:null
}))}
function addItem(item={}){
 const empty=$("#cook-items .cook-empty");if(empty)empty.remove();
 const tr=document.createElement("tr");
 tr.innerHTML='<td><input class="item-name" maxlength="160" aria-label="Food item" placeholder="Food item name" required></td><td><input class="item-category" list="cook-category-options" maxlength="80" aria-label="Category" placeholder="Category"></td><td><input class="item-offered" type="number" min="0" step="0.01" value="0" aria-label="Quantity offered" required></td><td><input class="item-reused" type="number" min="0" step="0.01" value="0" aria-label="Quantity reused" required></td><td><input class="item-waste" type="number" min="0" step="0.01" value="0" aria-label="Quantity wasted" required></td><td><input class="item-unit" maxlength="40" value="servings" aria-label="Unit"></td><td><button type="button" class="secondary remove-item">Remove</button></td>';
 tr.querySelector(".item-name").value=item.item_name||"";tr.querySelector(".item-category").value=item.category||"Other";
 tr.querySelector(".item-offered").value=item.quantity_offered??0;tr.querySelector(".item-reused").value=item.quantity_reused??0;
 tr.querySelector(".item-waste").value=item.quantity_wasted??0;tr.querySelector(".item-unit").value=item.unit_name||"servings";
 tr.querySelector(".remove-item").onclick=()=>{tr.remove();if(!$("#cook-items").querySelector("tr"))$("#cook-items").innerHTML='<tr class="cook-empty"><td colspan="7">Add the food items served for this meal.</td></tr>'};
 $("#cook-items").appendChild(tr);
}
function resetForm(){
 editingId=null;$("#cook-school").value="";$("#cook-date").value=new Date().toLocaleDateString("en-CA");$("#cook-program").value="";$("#cook-notes").value="";
 $("#cook-items").innerHTML='<tr class="cook-empty"><td colspan="7">Add the food items served for this meal.</td></tr>';addItem();
 $("#cook-save-draft").textContent="Save draft";$("#cook-submit").disabled=false;$("#cook-submit").textContent="Submit report";say("Ready for a new meal report.");
}
async function saveDraft(){
 const b=$("#cook-save-draft");b.disabled=true;
 try{
  const school_id=$("#cook-school").value,service_date=$("#cook-date").value,meal_program=$("#cook-program").value,notes=$("#cook-notes").value.trim(),items=itemRows();
  if(!school_id||!service_date||!meal_program)throw Error("Choose a school, service date, and meal program.");
  if(!items.length)throw Error("Add at least one food item.");
  if(items.some(x=>!x.item_name||![x.quantity_offered,x.quantity_reused,x.quantity_wasted].every(n=>Number.isFinite(n)&&n>=0)))throw Error("Every item needs a name and non-negative quantities.");
  const {data,error}=await db.rpc("cook_save_meal_report",{p_report_id:editingId,p_school_id:school_id,p_service_date:service_date,p_meal_program:meal_program,p_notes:notes,p_items:items});
  if(error)throw error;editingId=data;$("#cook-save-draft").textContent="Save draft";$("#cook-submit").disabled=false;
  say("Draft saved securely. You can continue editing or submit it.");await loadReports();
 }catch(e){say(e.message||"Draft could not be saved.",true)}finally{b.disabled=false}
}
async function submitReport(){
 if(!editingId){say("Save the draft before submitting.",true);return}
 const b=$("#cook-submit");b.disabled=true;
 try{const {error}=await db.rpc("cook_submit_meal_report",{p_report_id:editingId});if(error)throw error;say("Report submitted to the administrator for review.");resetForm();await loadReports()}
 catch(e){say(e.message||"Report could not be submitted.",true)}finally{b.disabled=false}
}
async function editReport(id){
 const r=reportRows.find(x=>x.id===id);if(!r)return;
 if(!["draft","returned"].includes(r.status)){say("Only draft or returned reports can be edited.",true);return}
 editingId=r.id;$("#cook-school").value=r.school_id;$("#cook-date").value=r.service_date;$("#cook-program").value=r.meal_program;$("#cook-notes").value=r.notes||"";
 $("#cook-items").innerHTML="";(r.meal_report_items||[]).forEach(addItem);if(!(r.meal_report_items||[]).length)addItem();
 $("#cook-save-draft").textContent="Save changes";$("#cook-submit").disabled=false;
 say(r.status==="returned"?"This report was returned: "+(r.return_note||"Please review and correct it."):"Editing saved draft.");
 window.scrollTo({top:0,behavior:"smooth"});
}
async function loadReports(){
 const root=$("#cook-reports");root.textContent="Loading reports…";
 const {data,error}=await db.from("meal_reports").select("id,school_id,service_date,meal_program,status,notes,submitted_at,approved_at,returned_at,return_note,created_at,updated_at,schools(name),meal_report_items(id,item_name,category,quantity_offered,quantity_reused,quantity_wasted,unit_name)").eq("cook_id",user.id).order("service_date",{ascending:false}).limit(100);
 if(error){root.textContent="Saved reports are unavailable until the database migration is installed.";return}
 reportRows=data||[];
 if(!reportRows.length){root.innerHTML='<p class="cook-muted">No reports yet. Save a draft to get started.</p>';return}
 root.innerHTML='<div style="overflow-x:auto"><table class="cook-table"><thead><tr><th>Service date</th><th>School</th><th>Program</th><th>Items</th><th>Status</th><th>Details / action</th></tr></thead><tbody>'+reportRows.map(r=>'<tr><td>'+esc(r.service_date)+'</td><td>'+esc(r.schools?.name||"School")+'</td><td>'+esc(r.meal_program)+'</td><td>'+((r.meal_report_items||[]).length)+'</td><td>'+esc(r.status)+'</td><td>'+(r.status==="draft"||r.status==="returned"?'<button type="button" class="secondary edit-report" data-id="'+esc(r.id)+'">Edit</button> ':"")+(r.return_note?'<div class="cook-muted">'+esc(r.return_note)+'</div>':"")+'</td></tr>').join("")+'</tbody></table></div>';
 root.querySelectorAll(".edit-report").forEach(b=>b.onclick=()=>editReport(b.dataset.id));
}
init().catch(e=>say(e.message||"Could not verify Cook account.",true));
})();