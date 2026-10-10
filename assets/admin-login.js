(()=>{
 const cfg=window.FUEL_THE_FIRE_CONFIG||{};
 const form=document.querySelector("#admin-login-form");
 const msg=document.querySelector("#message");
 const btn=document.querySelector("#submit-button");
 const say=(text,ok=false)=>{msg.textContent=text;msg.className="message"+(ok?" success":"");};
 if(!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||cfg.SUPABASE_ANON_KEY.startsWith("PASTE_")){
   say("Setup required: add your Supabase public anon/publishable key in assets/config.js. Never use a service-role or secret key here."); return;
 }
 const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
 async function verifyAdmin(){
   const {data:{user},error:authError}=await db.auth.getUser();
   if(authError||!user) return false;
   const {data:profile,error}=await db.from("profiles").select("role,active,must_change_password").eq("id",user.id).single();
   if(error) throw new Error("Could not verify your profile. Check the profiles table and its RLS policies.");
   if(!profile||profile.role!=="admin"||profile.active!==true){
     await db.auth.signOut();
     throw new Error("This account is not an active administrator. Ask an existing administrator to verify your role.");
   }
   return true;
 }
 db.auth.getSession().then(async ({data,error})=>{
   if(error||!data.session)return;
   try{if(await verifyAdmin())location.replace("app.html");}catch(e){say(e.message);}
 });
 form.addEventListener("submit",async e=>{
   e.preventDefault();btn.disabled=true;btn.textContent="Signing in…";say("");
   try{
     const {error}=await db.auth.signInWithPassword({email:document.querySelector("#email").value.trim(),password:document.querySelector("#password").value});
     if(error)throw error;
     if(await verifyAdmin()){say("Administrator verified. Opening dashboard…",true);location.replace("app.html");}
   }catch(error){say(error.message||"Sign-in failed.");}
   finally{btn.disabled=false;btn.textContent="Sign in as administrator";}
 });
})();