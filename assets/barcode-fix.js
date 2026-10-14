(()=>{
"use strict";
let busy=false,reader=null,controls=null;
const $=s=>document.querySelector(s);
const GS=String.fromCharCode(29);
const FIXED={"00":18,"01":14,"02":14,"11":6,"12":6,"13":6,"15":6,"16":6,"17":6,"20":2,"410":13,"414":13,"422":3,"7003":10,"8005":6};
const VARIABLE={"10":20,"21":20,"22":20,"30":8,"37":8,"240":30,"241":30,"250":30,"400":30,"401":30,"402":30,"420":20,"421":15,"423":15,"424":3,"425":3,"426":3,"7001":13,"7002":30,"8004":30,"8006":18,"8018":18,"8020":25,"91":90,"92":90,"93":90,"94":90,"95":90,"96":90,"97":90,"98":90,"99":90};
const AI_NAMES={"00":"SSCC","01":"GTIN","02":"Content GTIN","10":"Lot/batch","11":"Production date","12":"Due date","13":"Packaging date","15":"Best-before date","16":"Sell-by date","17":"Expiration date","20":"Product variant","21":"Serial number","22":"Consumer product variant","30":"Variable count","37":"Count","240":"Additional product ID","241":"Customer part number","250":"Secondary serial","400":"Customer order number","401":"Consignment number","402":"Shipment identification number","410":"Ship-to GLN","414":"Physical location GLN","420":"Ship-to postal code","421":"Ship-to postal code with country","422":"Country of origin","423":"Country of initial processing","424":"Country of processing","425":"Country of disassembly","426":"Country covering full process chain","7001":"NATO stock number","7002":"Meat cut","7003":"Expiration date/time","8004":"GIAI","8005":"Price per unit","8006":"ITIP","8018":"GSRN","8020":"Payment slip reference"};
function dateValue(v){
 if(!/^\d{6}$/.test(v||""))return "";
 const yy=Number(v.slice(0,2)),m=Number(v.slice(2,4)),d=Number(v.slice(4,6)),y=yy>=50?1900+yy:2000+yy;
 if(m<1||m>12||d>31)return "";
 const day=d===0?new Date(y,m,0).getDate():d;
 const dt=new Date(y,m-1,day);
 if(dt.getFullYear()!==y||dt.getMonth()!==m-1||dt.getDate()!==day)return "";
 return y+"-"+String(m).padStart(2,"0")+"-"+String(day).padStart(2,"0");
}
function put(out,ai,v){
 v=String(v||"").trim();if(!v)return;
 out.elements[ai]=v;
 if(ai==="01"&&/^\d{14}$/.test(v))out.gtin=v;
 if(ai==="02"&&/^\d{14}$/.test(v))out.contentGtin=v;
 if(ai==="10")out.lot=v;
 if(ai==="17"||ai==="7003")out.expiration=dateValue(v.slice(0,6));
 if(ai==="15")out.bestBefore=dateValue(v);
 if(ai==="11")out.production=dateValue(v);
 if(ai==="13")out.packagingDate=dateValue(v);
 if(ai==="21")out.serial=v;
 if(ai==="30"||ai==="37")out.count=v;
}
function knownAI(s,i){
 for(const n of [4,3,2]){
  const candidate=s.slice(i,i+n);
  if(candidate in FIXED||candidate in VARIABLE)return candidate;
  if(n===4&&/^(310|320)[0-6]$/.test(candidate))return candidate;
  if(n===4&&/^39[23][0-9]$/.test(candidate))return candidate;
 }
 return "";
}
function parseGS1(raw){
 let s=String(raw||"").replace(/^\](?:d2|D2|C1|c1|d1|D1|E0|e0)/,"").replace(/\u001d/g,GS).trim();
 const out={elements:{},gtin:"",contentGtin:"",lot:"",expiration:"",bestBefore:"",production:"",packagingDate:"",serial:"",count:""};
 if(/^https?:\/\//i.test(s)){
  try{
   const u=new URL(s),p=u.pathname.match(/\/gtin\/(\d{8,14})(?:\/(lot|ser|exp|17|10|21)\/([^/]+))?/i);
   if(p){out.gtin=p[1].padStart(14,"0");if(p[2]&&p[3]){const key=p[2].toLowerCase();put(out,({lot:"10",ser:"21",exp:"17","17":"17","10":"10","21":"21"})[key],decodeURIComponent(p[3]));}}
   const params=[["lot","10"],["ser","21"],["exp","17"],["17","17"],["10","10"],["21","21"]];
   for(const [key,ai] of params){const v=u.searchParams.get(key);if(v)put(out,ai,decodeURIComponent(v));}
   if(out.gtin||Object.keys(out.elements).length)return out;
  }catch(_){}
 }
 if(/\(\d{2,4}\)/.test(s)){
  const re=/\((\d{2,4})\)([^()]*)/g;let m;
  while((m=re.exec(s)))put(out,m[1],m[2].replace(new RegExp(GS,"g"),""));
  return out;
 }
 let i=0,guard=0;
 while(i<s.length&&guard++<200){
  if(s.charAt(i)===GS){i++;continue;}
  const ai=knownAI(s,i);if(!ai)break;
  i+=ai.length;let value="";
  let fixedLength=FIXED[ai];
  if(!fixedLength&&/^(310|320)[0-6]$/.test(ai))fixedLength=6;
  if(!fixedLength&&/^39[23][0-9]$/.test(ai))fixedLength=0;
  if(fixedLength){value=s.slice(i,i+fixedLength);if(value.length<fixedLength)break;i+=fixedLength;}
  else{const sep=s.indexOf(GS,i);value=(sep<0?s.slice(i):s.slice(i,sep)).slice(0,VARIABLE[ai]||90);i=sep<0?s.length:sep;}
  put(out,ai,value);
 }
 return out;
}
async function loadZXing(){
 if(window.ZXingBrowser?.BrowserMultiFormatReader)return;
 const urls=["https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js","https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js"];
 let lastError;
 for(const url of urls){
  try{
   await new Promise((resolve,reject)=>{
    const s=document.createElement("script");s.src=url;s.async=true;s.dataset.ftfZxing="true";
    s.onload=resolve;s.onerror=()=>{s.remove();reject(Error("Could not load barcode decoder from "+new URL(url).hostname));};
    document.head.appendChild(s);
   });
   if(window.ZXingBrowser?.BrowserMultiFormatReader)return;
  }catch(e){lastError=e;}
 }
 throw Error((lastError?.message||"Barcode decoder did not initialize.")+" Check the internet connection and reload.");
}
async function lookupProduct(gtin){
 const codes=[String(gtin||"")],noLeading=String(gtin||"").replace(/^0+(?=\d)/,"");
 if(noLeading&&noLeading!==gtin)codes.push(noLeading);
 if(/^0\d{12}$/.test(gtin))codes.push(gtin.slice(1));
 for(const code of [...new Set(codes)]){
  for(const version of ["v3","v2"]){
   try{
    const fields="product_name,product_name_en,product_name_with_brand,abbreviated_product_name,generic_name,brands,quantity,code";
    const url=version==="v3"?"https://world.openfoodfacts.org/api/v3/product/"+encodeURIComponent(code)+".json?fields="+fields:"https://world.openfoodfacts.org/api/v2/product/"+encodeURIComponent(code)+".json?fields="+fields;
    const r=await fetch(url,{headers:{Accept:"application/json"}});if(!r.ok)continue;
    const d=await r.json();if(d.status!==1||!d.product)continue;
    const p=d.product,n=String(p.product_name_en||p.product_name||p.product_name_with_brand||p.abbreviated_product_name||p.generic_name||"").trim(),b=String(p.brands||"").split(",")[0].trim();
    return {name:n?(b&&!n.toLowerCase().includes(b.toLowerCase())?b+" "+n:n):"",quantity:String(p.quantity||"").trim(),brand:b};
   }catch(_){}
  }
 }
 return {name:"",quantity:"",brand:""};
}
function showMessage(text,error=false){const m=$("#global-message");if(m){m.textContent=text;m.className="global-message"+(error?" error":" success");}}
function appendNotes(lines){
 const el=$("#pnotes");if(!el||!lines.length)return;
 const current=el.value.trim(),tag="GS1 scan details:";
 const addition=tag+"\n"+lines.join("\n");
 if(!current.includes(tag))el.value=current?current+"\n\n"+addition:addition;
}
async function fillFromScan(raw,button){
 const clean=String(raw||"").trim(),gs1=parseGS1(clean);
 const plain=clean.replace(/^\](?:E0|e0|C1|c1|d1|D1|d2|D2)/,"").trim();
 const looksGs1=!!(gs1.gtin||gs1.contentGtin||gs1.lot||gs1.expiration||gs1.production||gs1.serial||Object.keys(gs1.elements).length);
 const code=gs1.gtin||(/^\d{8,14}$/.test(plain)?plain:(!looksGs1&&/^\d+$/.test(plain)?plain:""));
 const details=Object.entries(gs1.elements).map(([ai,v])=>(AI_NAMES[ai]||("AI "+ai))+": "+v);
 if(gs1.serial)details.push("Serial number: "+gs1.serial);
 if(gs1.production)details.push("Production date: "+gs1.production);
 if(gs1.bestBefore)details.push("Best-before date: "+gs1.bestBefore);
 if(gs1.packagingDate)details.push("Packaging date: "+gs1.packagingDate);
 if(button.id==="pbscan"||button.id==="scannew"){
  if($("#pb")&&code)$("#pb").value=code;
  if(gs1.lot&&$("#plot"))$("#plot").value=gs1.lot;
  if(gs1.expiration&&$("#pexp"))$("#pexp").value=gs1.expiration;
  appendNotes(details.filter(x=>!/^Lot\/batch:|^Expiration date:/.test(x)));
  if(code){
   showMessage("Barcode decoded. Checking for product details…");
   const p=await lookupProduct(code);
   if($("#pn")&&p.name&&!$("#pn").value.trim())$("#pn").value=p.name;
   if($("#pquantityhint")&&p.quantity&&!$("#pquantityhint").value.trim())$("#pquantityhint").value=p.quantity;
   if(p.name)showMessage("Barcode decoded. Product name and available packaging details imported from an online lookup. Verify before saving.");
   else showMessage("Barcode decoded"+(looksGs1?"; GS1 details imported":"")+". No product name was found online, so enter the name manually.",true);
  }else if(looksGs1){
   showMessage("GS1 data decoded. Available details were imported; no product GTIN was found, so the product barcode field was left unchanged.",true);
  }else{
   showMessage("Barcode text decoded, but it did not look like a GTIN/UPC/EAN number. Raw value: "+clean,true);
   appendNotes(["Raw barcode text: "+clean]);
  }
 }
 if(button.id==="pcbscan"){if($("#pcb")&&code)$("#pcb").value=code;showMessage(code?"Case barcode decoded.":"No GTIN/UPC/EAN number was found in that scan.",!code);if(!code)appendNotes(["Case barcode text: "+clean]);}
 if(button.id==="mscan"){
  const hint=$("#mh");if(hint)hint.textContent="Scan read "+(gs1.gtin?"GTIN "+gs1.gtin:code||clean)+(gs1.lot?" • Lot "+gs1.lot:"")+(gs1.expiration?" • Exp "+gs1.expiration:"")+(gs1.serial?" • Serial "+gs1.serial:"")+". Select the matching product and save the movement.";
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
 const host=document.createElement("div");host.id="ftf-gs1-scanner";host.className="scanner-host";
 host.innerHTML='<div class="modal-backdrop"><div class="modal scanner-modal"><div class="modal-top"><h2>Scan barcode</h2><button type="button" class="close" id="ftf-gs1-close">×</button></div><p class="small">Scan a UPC, EAN, Code 128, ITF, or GS1 DataMatrix barcode. Available GTIN, lot, expiration, production date, serial, count and other supported GS1 fields will be imported.</p><video id="ftf-gs1-video" style="width:100%;max-height:55vh;object-fit:contain;background:#000;border-radius:12px" playsinline></video><p id="ftf-gs1-status" class="message">Loading camera scanner…</p><form id="ftf-gs1-manual"><label>Barcode / GS1 text (optional manual entry)</label><div class="scan-field"><input id="ftf-gs1-input" autocomplete="off" placeholder="Paste decoded text here"><button class="primary">Import text</button></div></form></div></div>';
 root.appendChild(host);
 const status=$("#ftf-gs1-status"),set=s=>{if(status)status.textContent=s;};
 $("#ftf-gs1-close").onclick=closeScanner;
 $("#ftf-gs1-manual").onsubmit=e=>{e.preventDefault();const v=$("#ftf-gs1-input").value.trim();if(v){closeScanner();void fillFromScan(v,button)}else set("Scan a barcode with the camera or paste decoded text above.");};
 try{
  await loadZXing();
  const Reader=window.ZXingBrowser.BrowserMultiFormatReader;reader=new Reader();
  const video=$("#ftf-gs1-video");let locked=false;
  const callback=(result,error,ctrl)=>{
   if(ctrl)controls=ctrl;
   if(locked||!result)return;
   locked=true;const raw=result.getText();closeScanner();void fillFromScan(raw,button);
  };
  await reader.decodeFromConstraints({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false},video,callback);
  set("Camera ready. Hold the entire barcode steady, close enough for its bars or small squares to be sharp. Allow camera access if asked.");
 }catch(e){
  set((e.message||"Camera could not start.")+" You can paste decoded barcode text below. If camera permission was denied, allow it for this website and reload.");
 }
}
document.addEventListener("click",e=>{
 const target=e.target instanceof Element?e.target:null,b=target?.closest("#pbscan,#pcbscan,#scannew,#mscan");if(!b)return;
 e.preventDefault();e.stopImmediatePropagation();void openScanner(b);
},true);
})();