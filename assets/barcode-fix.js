(()=>{
"use strict";
let busy=false,reader=null,controls=null;
const $=s=>document.querySelector(s);
const digits=v=>String(v||"").replace(/[^0-9]/g,"");
const FIXED={"01":14,"11":6,"12":6,"13":6,"15":6,"16":6,"17":6};
const VARIABLE={"10":20,"21":20,"22":20};
function dateValue(v){
 if(!/^\d{6}$/.test(v||""))return "";
 const y=2000+Number(v.slice(0,2)),m=Number(v.slice(2,4)),d=Number(v.slice(4,6));
 if(m<1||m>12||d>31)return "";
 const day=d===0?new Date(y,m,0).getDate():d;
 return day<1?"":y+"-"+String(m).padStart(2,"0")+"-"+String(day).padStart(2,"0");
}
function parseGS1(raw){
 let s=String(raw||"").replace(/^\](?:d2|D2)/,"").replace(/\u001d/g,"\x1d").trim();
 const out={};
 // Support human-readable scanner output such as (01)GTIN(17)YYMMDD(10)LOT.
 if(/\(\d{2,4}\)/.test(s)){
  const re=/\((\d{2,4})\)([^()]*)/g;let m;
  while((m=re.exec(s))){const ai=m[1],v=m[2].replace(/\x1d/g,"").trim();if(ai==="01"&&/^\d{14}$/.test(v))out.gtin=v;else if(ai==="10")out.lot=v;else if(ai==="17")out.expiration=dateValue(v);else if(ai==="11")out.production=dateValue(v);else if(ai==="21")out.serial=v;}
  return out;
 }
 let i=0,guard=0;
 while(i<s.length&&guard++<100){
  if(s.charCodeAt(i)===29){i++;continue;}
  const ai=s.slice(i,i+2);
  if(!(ai in FIXED)&&!(ai in VARIABLE)){break;}
  i+=2;let value="";
  if(ai in FIXED){const len=FIXED[ai];value=s.slice(i,i+len);i+=len;}
  else {const sep=s.indexOf("\x1d",i);value=(sep<0?s.slice(i):s.slice(i,sep)).slice(0,VARIABLE[ai]);i=sep<0?s.length:sep;}
  if(ai==="01"&&/^\d{14}$/.test(value))out.gtin=value;
  else if(ai==="10")out.lot=value;
  else if(ai==="17")out.expiration=dateValue(value);
  else if(ai==="11")out.production=dateValue(value);
  else if(ai==="21")out.serial=value;
 }
 return out;
}
async function loadZXing(){
 if(window.ZXingBrowser?.BrowserMultiFormatReader)return;
 await new Promise((resolve,reject)=>{
  const old=document.querySelector('script[data-ftf-zxing]');
  if(old){old.addEventListener("load",resolve,{once:true});old.addEventListener("error",()=>reject(Error("The 2D barcode scanner could not load.")),{once:true});return;}
  const s=document.createElement("script");s.src="https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js";s.async=true;s.dataset.ftfZxing="true";s.onload=resolve;s.onerror=()=>reject(Error("The 2D barcode scanner could not load. Check your internet connection."));document.head.appendChild(s);
 });
 if(!window.ZXingBrowser?.BrowserMultiFormatReader)throw Error("The 2D barcode decoder did not initialize. Reload the page and try again.");
}
async function lookupName(gtin){
 const codes=[String(gtin||"")];
 const noLeading=String(gtin||"").replace(/^0+(?=\d)/,"");
 if(noLeading&&noLeading!==gtin)codes.push(noLeading);
 if(/^0\d{12}$/.test(gtin))codes.push(gtin.slice(1));
 for(const code of [...new Set(codes)]){
  for(const version of ["v3","v2"]){
   try{
    const fields="product_name,product_name_en,product_name_with_brand,abbreviated_product_name,generic_name,brands";
    const url=version==="v3"?`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(code)}.json?fields=${fields}`:`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`;
    const r=await fetch(url,{headers:{Accept:"application/json"}});if(!r.ok)continue;
    const d=await r.json();if(d.status!==1||!d.product)continue;
    const p=d.product,n=String(p.product_name_en||p.product_name||p.product_name_with_brand||p.abbreviated_product_name||p.generic_name||"").trim(),b=String(p.brands||"").split(",")[0].trim();
    if(n)return b&&!n.toLowerCase().includes(b.toLowerCase())?b+" "+n:n;
   }catch(_){}
  }
 }
 return "";
}
function showMessage(text,error=false){const m=$("#global-message");if(m){m.textContent=text;m.className="global-message"+(error?" error":" success");}}
async function fillFromScan(raw,button){
 const gs1=parseGS1(raw),clean=String(raw||"").trim(),gtin=gs1.gtin||digits(clean);
 if(button.id==="pbscan"||button.id==="scannew"){
  const pb=$("#pb");if(pb)pb.value=gtin;
  if(gs1.lot&&$("#plot")&&!$("#plot").value)$("#plot").value=gs1.lot;
  if(gs1.expiration&&$("#pexp")&&!$("#pexp").value)$("#pexp").value=gs1.expiration;
  const name=$("#pn");
  if(name&&!name.value.trim()&&gtin){
   showMessage("Barcode read. Looking up the product name…");
   const n=await lookupName(gtin);
   if(n){name.value=n;showMessage("Barcode read. Product name found online—verify it before saving.");}
   else {showMessage("Barcode read, but no product name was found online. GTIN"+(gs1.gtin?" "+gs1.gtin:"")+" was entered. Enter the product name manually.",true);}
  }else if(gs1.gtin){showMessage("GS1 DataMatrix read. GTIN"+(gs1.gtin?" "+gs1.gtin:"")+(gs1.lot?" • Lot "+gs1.lot:"")+(gs1.expiration?" • Expiration "+gs1.expiration:"")+". Check the fields before saving.");}
  if(!gs1.gtin&&clean!==gtin)showMessage("Barcode scanned, but GS1 fields were not recognized. Check the barcode format and enter lot/expiration manually.",true);
 }
 if(button.id==="pcbscan"){const x=$("#pcb");if(x)x.value=gtin;showMessage("Case barcode scanned.");}
 if(button.id==="mscan"){
  const hint=$("#mh");if(hint)hint.textContent=`Scan read ${gs1.gtin?"GTIN "+gs1.gtin:gtin}${gs1.lot?" • Lot "+gs1.lot:""}${gs1.expiration?" • Exp "+gs1.expiration:""}. Select the matching product and save the movement.`;
 }
}
function closeScanner(){
 try{if(controls)controls.stop()}catch(_){}
 controls=null;try{if(reader)reader.reset()}catch(_){}
 reader=null;const h=$("#ftf-gs1-scanner");if(h)h.remove();busy=false;
}
async function openScanner(button){
 if(busy)return;busy=true;
 const root=$("#modal-root");if(!root){busy=false;showMessage("Scanner could not open because the modal area is missing.",true);return;}
 const host=document.createElement("div");host.id="ftf-gs1-scanner";
 host.innerHTML='<div class="modal-backdrop"><div class="modal scanner-modal"><div class="modal-top"><h2>Scan barcode</h2><button type="button" class="close" id="ftf-gs1-close">×</button></div><p class="small">Scan a UPC/EAN barcode or a GS1 DataMatrix. DataMatrix can contain GTIN, lot/batch and expiration details.</p><video id="ftf-gs1-video" style="width:100%;max-height:55vh;object-fit:contain;background:#000;border-radius:12px" playsinline></video><p id="ftf-gs1-status" class="message">Loading camera scanner…</p><form id="ftf-gs1-manual"><label>Barcode / GS1 DataMatrix text</label><div class="scan-field"><input id="ftf-gs1-input" autocomplete="off" placeholder="Enter scanned text if camera cannot read it" required><button class="primary">Use barcode</button></div></form></div></div>';
 root.appendChild(host);
 const status=$("#ftf-gs1-status"),set=s=>{if(status)status.textContent=s;};
 $("#ftf-gs1-close").onclick=closeScanner;
 $("#ftf-gs1-manual").onsubmit=e=>{e.preventDefault();const v=$("#ftf-gs1-input").value.trim();if(v){closeScanner();void fillFromScan(v,button);}};
 try{
  await loadZXing();
  const Reader=window.ZXingBrowser.BrowserMultiFormatReader;reader=new Reader();
  const video=$("#ftf-gs1-video");let locked=false;
  const callback=(result,error,ctrl)=>{
   if(ctrl)controls=ctrl;if(locked||!result)return;
   locked=true;const raw=result.getText();set("Barcode detected. Reading GS1 fields…");closeScanner();void fillFromScan(raw,button);
  };
  await reader.decodeFromConstraints({video:{facingMode:{ideal:"environment"}}},video,callback);
  set("Camera ready. Hold the barcode steady in good light. Aim the camera at the full square DataMatrix, not its printed text.");
 }catch(e){set((e.message||"Camera could not start.")+" You can type or paste the decoded barcode text below.");}
}
document.addEventListener("click",e=>{
 const b=e.target.closest("#pbscan,#pcbscan,#scannew,#mscan");if(!b)return;
 e.preventDefault();e.stopImmediatePropagation();void openScanner(b);
},true);
})();