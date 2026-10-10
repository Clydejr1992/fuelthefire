(()=>{
  "use strict";
  const $=s=>document.querySelector(s);
  let active=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function digits(v){return String(v||"").replace(/[^0-9]/g,"")}
  function validEan13(v){v=digits(v);if(v.length!==13)return false;let sum=0;for(let i=0;i<12;i++)sum+=Number(v[i])*(i%2?3:1);return(10-(sum%10))%10===Number(v[12])}
  function validEan8(v){v=digits(v);if(v.length!==8)return false;let sum=0;for(let i=0;i<7;i++)sum+=Number(v[i])*(i%2?1:3);return(10-(sum%10))%10===Number(v[7])}
  function validUpcA(v){v=digits(v);if(v.length!==12)return false;let sum=0;for(let i=0;i<11;i++)sum+=Number(v[i])*(i%2?1:3);return(10-(sum%10))%10===Number(v[11])}
  function canonical(v){const x=digits(v);if(validUpcA(x))return x;if(validEan13(x))return x.startsWith("0")?x.slice(1):x;if(validEan8(x))return x;return x}
  function candidates(v){const x=digits(v),a=[x],c=canonical(x);if(c&&!a.includes(c))a.push(c);if(x.length===12&&validUpcA(x))a.push("0"+x);if(x.length===13&&x[0]==="0"&&validEan13(x))a.push(x.slice(1));return[...new Set(a)]}
  async function loadScanner(){if(window.Html5Qrcode)return true;await new Promise((resolve,reject)=>{const old=document.querySelector('script[data-ftf-barcode]');if(old){old.addEventListener("load",resolve,{once:true});old.addEventListener("error",reject,{once:true});return}const s=document.createElement("script");s.src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";s.async=true;s.dataset.ftfBarcode="true";s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});return!!window.Html5Qrcode}
  function makeModal(){const root=$("#modal-root"),host=document.createElement("div");host.className="scanner-host";host.innerHTML='<div class="modal-backdrop"><div class="modal scanner-modal"><div class="modal-top"><h2>Scan product barcode</h2><button type="button" class="close" id="ftf-close">×</button></div><p class="small">Hold the barcode steady inside the box. Fuel the Fire confirms the same barcode 3 times before accepting it.</p><div id="ftf-reader"></div><p id="ftf-status" class="message">Starting camera…</p><form id="ftf-manual"><label>Barcode / UPC</label><div class="scan-field"><input id="ftf-code" inputmode="numeric" autocomplete="off" placeholder="Type barcode if needed" required><button class="primary">Use barcode</button></div></form></div></div>';root.appendChild(host);return host}
  async function scan(){if(active)return;active=true;const host=makeModal(),status=host.querySelector("#ftf-status");const set=s=>status.textContent=s;let reader=null,done=false,last="",streak=0;
    const finish=async code=>{if(done)return"";done=true;try{if(reader)await reader.stop()}catch(_){}try{if(reader)reader.clear()}catch(_){}host.remove();active=false;return canonical(code)};
    const route=async code=>{if(!code)return;const ids=candidates(code),btn=document.__ftfLastScanButton;
      if(btn?.id==="iscan"){const input=$("#isearch");if(input){input.value=code;input.dispatchEvent(new Event("input",{bubbles:true}))}return}
      if(btn?.id==="mscan"){
        let found=null;try{const cfg=window.FUEL_THE_FIRE_CONFIG||{},db=window.supabase?.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);if(db){const r=await db.from("products").select("id,name,barcode,active");found=(r.data||[]).find(p=>p.active!==false&&ids.includes(digits(p.barcode||"")))}}catch(_){ }
        const sel=$("#mp");if(found&&sel){sel.value=found.id;$("#mc")?.focus();}else alert("That barcode is not in Fuel the Fire yet. Add the product first, then scan it again.");return}
      if(btn?.id==="pbscan"){
        const input=$("#pb");if(input)input.value=code;const name=$("#pn");if(name&&!name.value.trim())await lookupName(code,name);return}
      if(btn?.id==="scannew"){
        const add=$("#addp");if(add){add.click();await sleep(75);const input=$("#pb");if(input)input.value=code;const name=$("#pn");if(name&&!name.value.trim())await lookupName(code,name)}
      }
    };
    host.querySelector("#ftf-close").onclick=()=>finish("");host.querySelector("#ftf-manual").onsubmit=async e=>{e.preventDefault();const v=digits(host.querySelector("#ftf-code").value);if(v){const c=await finish(v);route(c)}};
    try{await loadScanner();if(!window.Html5Qrcode)throw Error("Scanner failed to load.");const formats=[Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E,Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.CODE_39,Html5QrcodeSupportedFormats.ITF],cfg={fps:10,qrbox:{width:300,height:140},formatsToSupport:formats,disableFlip:true};const onRead=decoded=>{const x=digits(decoded);if(!x||done)return;const c=canonical(x);if(c===last)streak++;else{last=c;streak=1}const valid=(c.length===12&&validUpcA(c))||(c.length===13&&validEan13(c))||(c.length===8&&validEan8(c));set((valid?"Valid barcode read: ":"Barcode read: ")+c+" — confirming ("+streak+"/3)…");if(streak>=3)finish(c).then(route)};reader=new Html5Qrcode("ftf-reader");try{await reader.start({facingMode:{exact:"environment"}},cfg,onRead)}catch(_){try{await reader.start({facingMode:"environment"},cfg,onRead)}catch(__){const cams=await Html5Qrcode.getCameras();if(!cams?.length)throw Error("No camera found.");const cam=cams.find(c=>/back|rear|environment|main/i.test(c.label||""))||cams[cams.length-1];await reader.start(cam.id,cfg,onRead)}}set("Camera ready — hold steady until the same barcode is confirmed 3 times.")}catch(e){set((e.message||"Camera could not start.")+" You can type the barcode below.")}
  }
  async function lookupName(code,input){try{const r=await fetch("https://world.openfoodfacts.org/api/v3/product/"+encodeURIComponent(code)+".json?fields=product_name,brands");const d=await r.json(),n=String(d?.product?.product_name||"").trim(),b=String(d?.product?.brands||"").split(",")[0].trim();if(n)input.value=b&&!n.toLowerCase().includes(b.toLowerCase())?b+" "+n:n}catch(_){} }
  document.addEventListener("click",e=>{const b=e.target.closest("#iscan,#mscan,#pbscan,#scannew");if(!b)return;e.preventDefault();e.stopImmediatePropagation();document.__ftfLastScanButton=b;scan()},true);
})();
