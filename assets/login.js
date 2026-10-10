(()=> {
"use strict";
const cfg=window.FUEL_THE_FIRE_CONFIG||{};
const form=document.querySelector("#login-form"),message=document.querySelector("#login-message");
const say=(text,error=true)=>{message.textContent=text;message.className="message "+(error?"error":"success")};
if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||cfg.SUPABASE_ANON_KEY.startsWith("PASTE_")){
 say("Setup required: check the Supabase URL and public publishable/anon key in assets/config.js.");return;
}
const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
db.auth.getSession().then(async ({data,error})=>{
 if(error||!data.session)return;
 const {data:profile,error:pe}=await db.from("profiles").select("active").eq("id",data.session.user.id).maybeSingle();
 if(!pe&&profile&&profile.active!==false)location.replace("app.html");
});
form.addEventListener("submit",async event=>{
 event.preventDefault();const button=form.querySelector("button");button.disabled=true;button.textContent="Signing in…";say("");
 try{
  const {data,error}=await db.auth.signInWithPassword({email:document.querySelector("#email").value.trim(),password:document.querySelector("#password").value});
  if(error)throw error;
  const {data:profile,error:pe}=await db.from("profiles").select("active").eq("id",data.user.id).maybeSingle();
  if(pe||!profile||profile.active===false){await db.auth.signOut();throw new Error("Your profile is missing or inactive. Contact the Fuel the Fire administrator.");}
  location.replace("app.html");
 }catch(error){say(error.message||"Sign-in failed. Check your email and password.");button.disabled=false;button.textContent="Sign in securely"}
});
})();