(()=>{
  "use strict";
  const $=s=>document.querySelector(s);let active=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function digits(v){return String(v||"").replace(/[^0-9]/g,"")}
  function validEan13(v){v=digits(v);if(v.length!==13)return false;let sum=0;for(let i=0;i<12;i++)sum+=Number(v[i])*(i%2?3:1);return(10-(sum%10))%10===Number(v[12])}
  function validEan8(v){v=digits(v);if(v.length!==8)return false;let sum=0;for(let i=0;i<7;i++)sum+=Number(v[i])*(i%2?1:3);return(10-(sum%10))%10===Number(v[7])}
  function validUpcA(v){v=digits(v);if(v.length!==12)return false;let sum=0;for(let i=0;i<11;i++)sum+=Number(v[i])*(i%2?1:3);return(10-(sum%10))%10===Number(v[11])}
  function candidates(v){const x=digits(v),a=[x];if(x.length===12&&validUpcA(x))a.push("0"+x);if(x.length===13&&x[0]==="0"&&validEan13(x))a.push(x.slice(1));return[...new Set(a)]}
  function parseGs1(raw){
    let s=String(raw||"").replace(/^\]d2/","");
    s=s.replace(/\u001d/g,"\x1d");
    const out={};let i=0;
    const fixed={"00":18,"01":14,"02":14,"11":6,"12":6,"13":6,"15":6,"16":6,"17":6,"20":2,"37":8};
    while(i<s.length){
      if(s[i]==="\x1d"){i++;continue}
      let ai=s.slice(i,i+4),len=fixed[ai];
      if(len==null){ai=s.slice(i,i+3);len=null}
      if(len==null){ai=s.slice(i,i+2);const variable={"10":20,"21":20,"22":20,"30":8,"240":30,"241":30};len=variable[ai]??null}
      if(!ai||!/^\d{2,4}$/.test(ai)){i++;continue}
      i+=ai.length;
      let value="";
      if(len!=null){value=s.slice(i,i+len);i+=len}else{const end=s.indexOf("\x1d",i);value=end<0?s.slice(i):s.slice(i,end);i=end<0?s.length:end}
      if(ai==="01")out.gtin=value;
      else if(ai==="10")out.lot=value;
      else if(ai==="17")out.expiration=value;
      else if(ai==="15")out.bestBefore=value;
      else if(ai==="11")out.production=value;
      else if(ai==="21")out.serial=value;
    }
    if(!out.gtin&&/^\d{14}$/.test(s.slice(2,16))&&s.slice(0,2)==="01")out.gtin=s.slice(2,16);
    const date=v=>{if(!/^\d{6}$/.test(v||""))return"";const y=Number(v.slice(0,2)),m=v.slice(2,4),d=v.slice(4,6);return String(2000+y).padStart(4,"0")+"-"+m+"-"+d};
    if(out.expiration)out.expiration=date(out.expiration);
    if(out.bestBefore)out.bestBefore=date(out.bestBefore);
    return out;
  }
  function normalizedCode(v){const g=parseGs1(v);return g.gtin||digits(v)}
  async function loadScanner(){if(window.Html5Qrcode)return true;await new Promise((resolve,reject)=>{const old=document.querySelector('script[data-ftf-barcode]');if(old){old.addEventListener("load",resolve,{once:true});old.addEventListener("error",reject,{once:true});return}const s=document.createElement("script");s.src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";s.async=true;s.dataset.ftfBarcode="true";s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});return!!window.Html5Qrcode}
  function makeModal(){const root=$("#modal-root"),host=document.createElement("div");host.className="scanner-host";host.innerHTML='<div class="modal-backdrop"><div class="modal scanner-modal"><div class="modal-top"><h2>Scan product barcode</h2><button type="button" class="close" id="ftf-close">×</button></div><p class="small">Scan a standard barcode or GS1 DataMatrix. GS1 DataMatrix data such as GTIN, lot and expiration can be read automatically.</p><div id="ftf-reader"></div><p id="ftf-status" class="message">Starting camera…</p><form id="ftf-manual"><label>Barcode / GS1 DataMatrix</label><div class="scan-field"><input id="ftf-code" autocomplete="off" placeholder="Type barcode if needed" required><button class="primary">Use barcode</button></div></form></div></div></div>';root.appendChild(host);return host}
  async function scan(){if(active)return;active=true;const host=makeModal(),status=host.querySelector("#ftf-status");const set=s=>status.textContent=s;let reader=null,done=false,last="",streak=0;
    const finish=async code=>{if(done)return"";done=true;try{if(reader)await reader.stop()}catch(_){}try{if(reader)reader.clear()}catch(_){}host.remove();active=false;return code};
    const route=async raw=>{if(!raw)return;const gs1=parseGs1(raw),code=gs1.gtin||digits(raw),ids=candidates(code),btn=document.__ftfLastScanButton;
      if(btn?.id==="iscan"){const input=$("#isearch");if(input){input.value=code;input.dispatchEvent(new Event("input",{bubbles:true}))}return}
      if(btn?.id==="mscan"){let found=null,barcodeKind="unit";try{const cfg=window.FUEL_THE_FIRE_CONFIG||{},db=window.supabase?.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);if(db){const r=await db.from("products").select("id,name,barcode,case_barcode,units_per_case,active");const rows=r.data||[];found=rows.find(p=>p.active!==false&&ids.includes(digits(p.case_barcode||"")));if(found)barcodeKind="case";else found=rows.find(p=>p.active!==false&&ids.includes(digits(p.barcode||"")))}}catch(_){}const sel=$("#mp");if(found&&sel){sel.value=found.id;const cases=$("#mc"),units=$("#mu"),upc=Math.max(1,Number(found.units_per_case)||1),mode=$("#mscanmode")?.value||"unit";if(mode==="case")cases.value=String((Number(cases.value)||0)+1);else{let n=(Number(units.value)||0)+1;if(n>=upc){cases.value=String((Number(cases.value)||0)+Math.floor(n/upc));n=n%upc}units.value=String(n)}const hint=$("#mh");if(hint)hint.textContent=(mode==="case"?"Added 1 case/box of ":"Added 1 individual item of ")+found.name+". Scanned barcode type: "+(barcodeKind==="case"?"case/box":"individual item")+". Scan more, then Save movement to update stock.";const msg=$("#mmsg");if(msg){msg.textContent=(mode==="case"?"Case/box quantity +1 — ":"Individual quantity +1 — ")+found.name;msg.className="message"}}else alert("That barcode is not in Fuel the Fire yet. Add it as a case or individual barcode first.");return}
      if(btn?.id==="pbscan"||btn?.id==="pcbscan"){const input=$(btn.id==="pcbscan"?"#pcb":"#pb");if(input)input.value=code;if(gs1.lot&&$("#plot")&&!$("#plot").value)$("#plot").value=gs1.lot;if(gs1.expiration&&$("#pexp")&&!$("#pexp").value)$("#pexp").value=gs1.expiration;if(btn.id==="pbscan"){const name=$("#pn");if(name&&!name.value.trim())await lookupName(code,name)}return}
      if(btn?.id==="scannew"){const add=$("#addp");if(add){add.click();await sleep(75);const input=$("#pb");if(input)input.value=code;if(gs1.lot&&$("#plot")&&!$("#plot").value)$("#plot").value=gs1.lot;if(gs1.expiration&&$("#pexp")&&!$("#pexp").value)$("#pexp").value=gs1.expiration;const name=$("#pn");if(name&&!name.value.trim())await lookupName(code,name)}}
    };
    host.querySelector("#ftf-close").onclick=()=>finish("");host.querySelector("#ftf-manual").onsubmit=async e=>{e.preventDefault();const v=host.querySelector("#ftf-code").value.trim();if(v){const c=await finish(v);route(c)}};
    try{await loadScanner();if(!window.Html5Qrcode)throw Error("Scanner failed to load.");const formats=[Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E,Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.CODE_39,Html5QrcodeSupportedFormats.ITF,Html5QrcodeSupportedFormats.DATA_MATRIX],cfg={fps:10,qrbox:{width:300,height:180},formatsToSupport:formats,disableFlip:true};const onRead=decoded=>{const x=String(decoded||"").trim();if(!x||done)return;if(x===last)streak++;else{last=x;streak=1}const gs1=parseGs1(x),code=gs1.gtin||digits(x),valid=!!gs1.gtin||((code.length===12&&validUpcA(code))||(code.length===13&&validEan13(code))||(code.length===8&&validEan8(code)));set((gs1.gtin?"GS1 DataMatrix read — GTIN "+gs1.gtin+"":"Barcode read: "+code)+" — confirming ("+streak+"/3)…");if(streak>=3&&valid)finish(x).then(route)};reader=new Html5Qrcode("ftf-reader");try{await reader.start({facingMode:{exact:"environment"}},cfg,onRead)}catch(_){try{await reader.start({facingMode:"environment"},cfg,onRead)}catch(__){const cams=await Html5Qrcode.getCameras();if(!cams?.length)throw Error("No camera found.");const cam=cams.find(c=>/back|rear|environment|main/i.test(c.label||""))||cams[cams.length-1];await reader.start(cam.id,cfg,onRead)}}set("Camera ready — standard barcodes and GS1 DataMatrix supported.")}catch(e){set((e.message||"Camera could not start.")+" You can type the barcode below.")}
  }
  async function lookupName(code,input){try{const gtin=parseGs1(code).gtin||digits(code);const r=await fetch("https://world.openfoodfacts.org/api/v3/product/"+encodeURIComponent(gtin)+".json?fields=product_name,product_name_en,brands");const d=await r.json(),n=String(d?.product?.product_name_en||d?.product?.product_name||"").trim(),b=String(d?.product?.brands||"").split(",")[0].trim();if(n)input.value=b&&!n.toLowerCase().includes(b.toLowerCase())?b+" "+n:n}catch(_){} }
  document.addEventListener("click",e=>{const b=e.target.closest("#iscan,#mscan,#pbscan,#pcbscan,#scannew");if(!b)return;e.preventDefault();e.stopImmediatePropagation();document.__ftfLastScanButton=b;scan()},true);
})();
