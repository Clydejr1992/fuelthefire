(()=>{"use strict";
const cfg=window.FUEL_THE_FIRE_CONFIG||{},$=s=>document.querySelector(s);
if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY){location.replace("index.html");return}
const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
const say=(s,bad=false)=>{const e=$("#cook-message");e.textContent=s;e.style.color=bad?"#b91c1c":"#166534"};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let user,profile;
async function init(){
 const {data:{session}}=await db.auth.getSession();
 if(!session){location.replace("index.html");return}
 user=session.user;
 const {data:p,error}=await db.from("profiles").select("id,full_name,email,role,active,must_change_password").eq("id",user.id).maybeSingle();
 if(error||!p||p.active!==true){await db.auth.signOut();location.replace("index.html");return}
 profile=p;
 if(profile.role!=="cook"){say("This page is only for Cook accounts. Returning to the main app.",true);setTimeout(()=>location.replace("app.html"),900);return}
 $("#cook-identity").textContent=(profile.full_name||profile.email)+" • Cook";
 if(profile.must_change_password){say("Please finish password setup from the main app before using Cook reports.",true);location.replace("app.html");return}
 await loadAssignedSchools();
 $("#cook-add-item").onclick=addItem;
 $("#cook-signout").onclick=async()=>{await db.auth.signOut();location.replace("index.html")};
 $("#cook-save-draft").onclick=()=>say("Draft saving is intentionally disabled in this preview. No report data was written.");
 $("#cook-submit").disabled=true;
}
async function loadAssignedSchools(){
 const sel=$("#cook-school");
 const {data,error}=await db.from("cook_school_assignments").select("school_id,schools(id,name,active)").eq("cook_id",user.id).is("revoked_at",null);
 if(error){sel.innerHTML='<option value="">School assignments not available in preview</option>';say("The Cook database migration has not been applied; no school data was changed.",true);return}
 const rows=(data||[]).filter(a=>a.schools&&a.schools.active);
 sel.innerHTML='<option value="">Choose assigned school</option>'+rows.map(a=>'<option value="'+esc(a.school_id)+'">'+esc(a.schools.name)+'</option>').join("");
 if(!rows.length)say("No active school assignments yet. Ask an administrator to assign your schools.");
}
function addItem(){
 const empty=$("#cook-items .cook-empty");if(empty)empty.remove();
 const tr=document.createElement("tr");
 tr.innerHTML='<td><input class="item-name" maxlength="160" aria-label="Food item" placeholder="Food item name" required></td><td><input class="item-category" maxlength="80" aria-label="Category" placeholder="Category"></td><td><input class="item-offered" type="number" min="0" step="0.01" value="0" aria-label="Quantity offered"></td><td><input class="item-reused" type="number" min="0" step="0.01" value="0" aria-label="Quantity reused"></td><td><input class="item-waste" type="number" min="0" step="0.01" value="0" aria-label="Quantity wasted"></td><td><input class="item-unit" maxlength="40" value="servings" aria-label="Unit"></td><td><button type="button" class="secondary remove-item">Remove</button></td>';
 tr.querySelector(".remove-item").onclick=()=>{tr.remove();if(!$("#cook-items").children.length)$("#cook-items").innerHTML='<tr class="cook-empty"><td colspan="7">Add the food items served for this meal.</td></tr>'};
 $("#cook-items").appendChild(tr);
}
init().catch(e=>say(e.message||"Could not verify Cook account.",true));
})();