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
 $("#cook-add-item").onclick=addItem;$("#cook-scan-item").onclick=scanItemForReport;
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

async function scanItemForReport(){
 const button=$("#cook-scan-item");button.disabled=true;
 const root=document.createElement("div");root.className="scanner-host";root.id="cook-barcode-scanner";
 root.innerHTML='<div class="modal-backdrop"><div class="modal scanner-modal"><div class="modal-top"><h2>Scan food item barcode</h2><button type="button" class="close" id="cook-scan-close">×</button></div><p class="small">Point the rear camera at a UPC/EAN barcode. If the product is listed in the food database, its name and package size will be imported. You can enter the name manually if it is not found.</p><div id="cook-barcode-reader"></div><div class="form-actions"><button type="button" class="secondary" id="cook-scan-torch" disabled>🔦 Flashlight unavailable</button></div><p id="cook-scan-status" class="message">Starting camera…</p><form id="cook-scan-manual"><label>Barcode / UPC</label><div class="scan-field"><input id="cook-scan-code" autocomplete="off" placeholder="Scan or type barcode" required><button class="primary">Look up item</button></div></form></div></div>';
 document.body.appendChild(root);
 let reader=null,closed=false,torchOn=false,torchSupported=false;
 const status=root.querySelector("#cook-scan-status");
 const setStatus=(s,bad=false)=>{status.textContent=s;status.className="message"+(bad?" error":"");};
 const close=async()=>{if(closed)return;closed=true;if(reader){try{await reader.stop()}catch(_){}try{reader.clear()}catch(_){}}root.remove();button.disabled=false;};
 const importCode=async(code)=>{
  code=String(code||"").trim();if(!code)return;
  setStatus("Looking up barcode…");
  const fields="product_name,product_name_en,product_name_with_brand,abbreviated_product_name,generic_name,brands,quantity,code";
  let found=null;
  const codes=[code];if(/^\d{8,14}$/.test(code)){const noZero=code.replace(/^0+(?=\d)/,"");if(noZero!==code)codes.push(noZero);if(/^0\d{12}$/.test(code))codes.push(code.slice(1));}
  for(const c of [...new Set(codes)]){for(const version of ["v3","v2"]){try{const url=version==="v3"?"https://world.openfoodfacts.org/api/v3/product/"+encodeURIComponent(c)+".json?fields="+fields:"https://world.openfoodfacts.org/api/v2/product/"+encodeURIComponent(c)+".json?fields="+fields;const res=await fetch(url,{headers:{Accept:"application/json"}});if(!res.ok)continue;const data=await res.json();if(data.status===1&&data.product){const p=data.product;const n=String(p.product_name_en||p.product_name||p.product_name_with_brand||p.abbreviated_product_name||p.generic_name||"").trim();const brand=String(p.brands||"").split(",")[0].trim();found={name:n?(brand&&!n.toLowerCase().includes(brand.toLowerCase())?brand+" "+n:n):"",quantity:String(p.quantity||"").trim()};if(found.name)break;}}catch(_){}}if(found?.name)break;}
  await close();
  if(found?.name){addItem({item_name:found.name,category:"Other",unit_name:"servings"});const rows=[...$("#cook-items").querySelectorAll("tr")].filter(tr=>tr.querySelector(".item-name"));const tr=rows[rows.length-1];tr.querySelector(".item-name").focus();say("Imported "+found.name+" from the barcode lookup. Verify the item and enter the quantities for this meal.");}
  else{const name=window.prompt("This barcode was not found in the online product database. Enter the food item name:");if(name&&name.trim()){addItem({item_name:name.trim(),category:"Other",unit_name:"servings"});const rows=[...$("#cook-items").querySelectorAll("tr")].filter(tr=>tr.querySelector(".item-name"));rows[rows.length-1].querySelector(".item-name").focus();say("Food item added. The barcode was not matched online, so please verify the name.");}else say("Barcode "+code+" was not found. Add the food item manually or try another scan.",true);}
 };
 root.querySelector("#cook-scan-close").onclick=()=>close();
 root.querySelector("#cook-scan-torch").onclick=async()=>{if(!reader||!torchSupported)return;try{torchOn=!torchOn;await reader.applyVideoConstraints({advanced:[{torch:torchOn}]});root.querySelector("#cook-scan-torch").textContent=torchOn?"🔦 Turn flashlight off":"🔦 Turn flashlight on";setStatus(torchOn?"Flashlight is on.":"Flashlight is off.");}catch(_){setStatus("This camera does not support flashlight control. Use your phone flashlight.",true);}};
 root.querySelector("#cook-scan-manual").onsubmit=e=>{e.preventDefault();const code=root.querySelector("#cook-scan-code").value.trim();if(code)void importCode(code);};
 try{
  if(!window.Html5Qrcode){await new Promise((resolve,reject)=>{const existing=document.querySelector("script[data-html5-qrcode]");if(existing){existing.addEventListener("load",resolve,{once:true});existing.addEventListener("error",reject,{once:true});return;}const s=document.createElement("script");s.src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";s.async=true;s.dataset.html5Qrcode="true";s.onload=resolve;s.onerror=()=>reject(Error("Camera scanner could not load. Check your connection."));document.head.appendChild(s);});}
  if(closed)return;if(!window.Html5Qrcode)throw Error("Camera scanner did not load.");
  const formats=[Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E,Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.CODE_39,Html5QrcodeSupportedFormats.ITF];
  reader=new Html5Qrcode("cook-barcode-reader");
  const decoded=async text=>{if(closed)return;root.querySelector("#cook-scan-code").value=String(text||"").trim();await importCode(text);};
  try{await reader.start({facingMode:"environment"},{fps:15,qrbox:{width:280,height:120},formatsToSupport:formats},decoded);}
  catch(first){try{try{reader.clear()}catch(_){}reader=new Html5Qrcode("cook-barcode-reader");const cameras=await Html5Qrcode.getCameras();if(!cameras?.length)throw first;const cam=cameras.find(c=>/back|rear|environment|main/i.test(c.label||""))||cameras[cameras.length-1];await reader.start(cam.id,{fps:15,qrbox:{width:280,height:120},formatsToSupport:formats},decoded);}catch(second){throw Error((second.message||first.message||"Camera could not start.")+" Open the site in Safari, allow camera access, and reload.");}}
  try{torchSupported=!!reader.getRunningTrackCapabilities?.().torch;}catch(_){}
  const torch=root.querySelector("#cook-scan-torch");torch.disabled=!torchSupported;torch.textContent=torchSupported?"🔦 Turn flashlight on":"🔦 Flashlight not supported";
  setStatus("Camera ready. Hold the barcode steady inside the scan box.");
 }catch(e){setStatus((e.message||"Camera could not start.")+" You can type the barcode above instead.",true);}
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