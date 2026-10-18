(()=>{"use strict";
const cfg=window.FUEL_THE_FIRE_CONFIG||{},$=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=v=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:2});
let busy=false;
async function render(){
 const title=$("#page-title"),host=$("#page-content");
 if(!title||title.textContent.trim()!=="Cook meal reports"||!host||host.querySelector("#combined-final-reports")||busy||!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
 busy=true;
 try{
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  const auth=await db.auth.getSession(),session=auth.data&&auth.data.session;if(!session)return;
  const me=await db.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
  if(me.error||!me.data||me.data.role!=="admin")return;
  const [rr,pr]=await Promise.all([
   db.from("meal_reports").select("id,school_id,service_date,meal_program,cook_id,status,notes,schools(name),meal_report_items(id,item_name,category,quantity_offered,quantity_reused,quantity_wasted,unit_name)").order("service_date",{ascending:false}).limit(500),
   db.from("profiles").select("id,full_name,email").eq("role","cook")
  ]);
  if(rr.error)throw rr.error;if(pr.error)throw pr.error;
  const names=new Map((pr.data||[]).map(p=>[p.id,p.full_name||p.email||"Cook"])),groups=new Map();
  (rr.data||[]).filter(r=>["submitted","approved"].includes(r.status)).forEach(r=>{const k=[r.school_id,r.service_date,r.meal_program].join("|");if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)});
  const matching=[...groups.entries()].filter(([,rs])=>rs.length>1);
  const panel=document.createElement("div");panel.id="combined-final-reports";panel.className="panel";panel.style.marginTop="20px";
  panel.innerHTML='<div class="panel-head"><div><h2>Combined Final School Reports</h2><p class="small">Groups submitted and approved reports by school, date, and meal program. Original cook submissions remain separate and unchanged.</p></div><button type="button" class="secondary" id="cfr-refresh">Refresh combined reports</button></div><div id="cfr-list"></div>';
  host.appendChild(panel);
  const table=(heads,rows)=>'<div class="table-wrap"><table><thead><tr>'+heads.map(x=>'<th>'+x+'</th>').join("")+'</tr></thead><tbody>'+(rows.length?rows.map(row=>'<tr>'+row.map(x=>'<td>'+x+'</td>').join("")+'</tr>').join(""):'<tr><td colspan="'+heads.length+'" class="empty">No items recorded.</td></tr>')+'</tbody></table></div>';
  const list=panel.querySelector("#cfr-list");
  if(!matching.length){list.innerHTML='<p class="muted">No matching school/date/program groups with multiple submitted or approved reports were found.</p>';}
  list.innerHTML=matching.length?matching.map(([key,rs],n)=>{
   rs.sort((a,b)=>String(names.get(a.cook_id)||"").localeCompare(String(names.get(b.cook_id)||"")));
   const items=new Map();
   rs.forEach(r=>(r.meal_report_items||[]).forEach(i=>{const k=[String(i.item_name||"").trim().toLowerCase(),String(i.category||"").trim().toLowerCase(),String(i.unit_name||"").trim().toLowerCase()].join("|");if(!items.has(k))items.set(k,{name:i.item_name||"Unnamed item",category:i.category||"—",unit:i.unit_name||"—",offered:0,reused:0,waste:0});const t=items.get(k);t.offered+=Number(i.quantity_offered||0);t.reused+=Number(i.quantity_reused||0);t.waste+=Number(i.quantity_wasted||0)}));
   const sum=(arr,k)=>arr.reduce((a,i)=>a+Number(i[k]||0),0),school=rs[0].schools&&rs[0].schools.name||"Unknown school",id="cfr-report-"+n;
   // Estimate whole servings actually distributed per distinct item (offered minus reused and wasted).
   // A qualifying meal requires three different items, and each item can count at most once per meal.
   const available=[...items.values()].map(i=>Math.max(0,Math.floor(Number(i.offered||0)-Number(i.reused||0)-Number(i.waste||0)+1e-9))).filter(q=>q>0);
   const qualifyingMeals=(()=>{if(available.length<3)return 0;const total=available.reduce((a,b)=>a+b,0);let lo=0,hi=Math.floor(total/3);while(lo<hi){const mid=Math.ceil((lo+hi)/2),capacity=available.reduce((a,q)=>a+Math.min(q,mid),0);if(capacity>=3*mid)lo=mid;else hi=mid-1;}return lo;})();
   const ir=[...items.values()].map(i=>[esc(i.name),esc(i.category),fmt(i.offered),fmt(i.reused),fmt(i.waste),esc(i.unit)]);
   ir.push(["<strong>COMBINED TOTAL</strong>","","<strong>"+fmt([...items.values()].reduce((a,i)=>a+i.offered,0))+"</strong>","<strong>"+fmt([...items.values()].reduce((a,i)=>a+i.reused,0))+"</strong>","<strong>"+fmt([...items.values()].reduce((a,i)=>a+i.waste,0))+"</strong>",""]);
   const original=rs.map(r=>{const its=r.meal_report_items||[];return '<section class="cfr-original" style="margin:14px 0;padding:12px;border:1px solid #d9e2de;border-radius:8px"><h3>Original Submission — '+esc(names.get(r.cook_id)||"Cook")+'</h3><p class="small">'+esc(r.service_date)+' · '+esc(r.meal_program)+' · Status: '+esc(r.status)+'</p>'+table(["Item","Category","Offered","Reused","Waste","Unit"],its.map(i=>[esc(i.item_name),esc(i.category),fmt(i.quantity_offered),fmt(i.quantity_reused),fmt(i.quantity_wasted),esc(i.unit_name)]))+'<p><strong>Cook totals:</strong> Offered '+fmt(sum(its,"quantity_offered"))+' · Reused '+fmt(sum(its,"quantity_reused"))+' · Waste '+fmt(sum(its,"quantity_wasted"))+'</p>'+(r.notes?'<p><strong>Notes:</strong> '+esc(r.notes)+'</p>':"")+'</section>'}).join("");
   return '<section class="cfr-report" id="'+id+'" style="margin:16px 0;padding:14px;border:1px solid #d9e2de;border-radius:10px"><div class="panel-head"><div><h3>'+esc(school)+' — '+esc(rs[0].meal_program)+'</h3><p class="small">'+esc(rs[0].service_date)+' · '+rs.length+' original submissions</p></div><button type="button" class="secondary cfr-print" data-target="'+id+'">Print Final Report</button></div><h4>Combined Item Totals</h4>'+table(["Item","Category","Offered","Reused","Waste","Unit"],ir)+'<section class="cfr-reimbursement" style="margin:18px 0;padding:14px;border:1px solid #d9e2de;border-radius:8px"><h4>Estimated Reimbursement</h4><p class="small">Automatically estimated from the combined item quantities: offered minus reused and wasted portions. Each qualifying meal must contain three different items, with no item counted more than once per meal. Verify against actual service records before claiming.</p><div style="display:flex;gap:14px;flex-wrap:wrap;align-items:end"><div><strong>Estimated qualifying meals: <span class="cfr-meal-count">'+qualifyingMeals.toLocaleString()</span></strong></div><label>Rate per meal ($)<br><input class="cfr-meal-rate" type="number" min="0" step="0.01" value="'+(rs[0].meal_program==="Supper"?"4.76":rs[0].meal_program==="Snack"?"1.30":"0.00")+'" style="padding:8px;max-width:160px"></label><div><strong>Estimated total: <span class="cfr-reimbursement-total">Enter meal count</span></strong></div></div><p class="small">Default rates shown are WV CACFP At-Risk rates for FY 2026–27: supper $4.76; snack $1.30. Confirm the program and rate before claiming. Rate source: West Virginia Department of Education.</p></section><h4 style="margin-top:20px">Original Submissions</h4>'+original+'</section>';
  }).join(""):'<p class="muted">No matching school/date/program groups with multiple submitted or approved reports were found.</p>';
  panel.querySelectorAll(".cfr-report").forEach(report=>{const count=Number(report.querySelector(".cfr-meal-count").textContent.replace(/,/g,"")),rate=report.querySelector(".cfr-meal-rate"),total=report.querySelector(".cfr-reimbursement-total");const update=()=>{const r=Number(rate.value);total.textContent=Number.isFinite(r)&&r>=0?"$"+(count*r).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):"Check rate"};rate.addEventListener("input",update);update();});
  panel.querySelectorAll(".cfr-print").forEach(b=>{const target=document.getElementById(b.dataset.target);if(!target)return;document.body.classList.add("cfr-printing");const style=document.createElement("style");style.id="cfr-print-style";style.textContent="@media print{body.cfr-printing *{visibility:hidden!important}body.cfr-printing .cfr-report,body.cfr-printing .cfr-report *{visibility:visible!important}body.cfr-printing .cfr-report{position:absolute;left:0;top:0;width:100%;border:0!important}.cfr-original{break-inside:avoid}.cfr-report button{display:none!important}}";document.head.appendChild(style);window.addEventListener("afterprint",()=>{document.body.classList.remove("cfr-printing");document.getElementById("cfr-print-style")?.remove()},{once:true});window.print()});
  panel.querySelector("#cfr-refresh").onclick=()=>{panel.remove();render()};
 }catch(e){const h=$("#page-content");if(h&&!h.querySelector("#combined-final-reports")){const p=document.createElement("div");p.id="combined-final-reports";p.className="panel";p.innerHTML='<h2>Combined Final School Reports</h2><p class="message error">'+esc(e.message||"Could not load combined reports.")+'</p>';h.appendChild(p)}}finally{busy=false}
}
const observer=new MutationObserver(()=>{if($("#page-title")?.textContent.trim()==="Cook meal reports"&&!$("#combined-final-reports"))render()});
observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
document.addEventListener("click",e=>{if(e.target.closest('[data-page="meal-reports"]'))setTimeout(render,350)});
setTimeout(render,800);
})();