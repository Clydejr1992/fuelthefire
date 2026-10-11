(()=> {
"use strict";
const cfg=window.FUEL_THE_FIRE_CONFIG||{};
const form=document.querySelector("#login-form"),message=document.querySelector("#login-message");
const say=(text,error=true)=>{message.textContent=text;message.className="message "+(error?"error":"success")};
if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||cfg.SUPABASE_ANON_KEY.startsWith("PASTE_")){
 say("Setup required: check the Supabase URL and public publishable/anon key in assets/config.js.");return;
}
const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
async function verifyEmployee(){
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user) return false;
 const {data:profile,error}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
 if(error) throw new Error("Could not verify your Fuel the Fire profile.");
 if(!profile||profile.active!==true){
   await db.auth.signOut();
   throw new Error("Your Fuel the Fire account is inactive or missing. Contact the administrator.");
 }
 if(profile.role==="admin"){
   await db.auth.signOut();
   throw new Error("Administrator accounts must sign in through the Administrator Sign In page.");
 }
 return true;
}
db.auth.getSession().then(async ({data,error})=>{
 if(error||!data.session)return;
 try{if(await verifyEmployee())location.replace("app.html");}catch(e){say(e.message);}
});
form.addEventListener("submit",async event=>{
 event.preventDefault();const button=form.querySelector("button");button.disabled=true;button.textContent="Signing in…";say("");
 try{
  const {error}=await db.auth.signInWithPassword({email:document.querySelector("#email").value.trim(),password:document.querySelector("#password").value});
  if(error)throw error;
  if(await verifyEmployee())location.replace("app.html");
 }catch(error){say(error.message||"Sign-in failed. Check your email and password.");}
 finally{button.disabled=false;button.textContent="Sign in securely";}
});
})();