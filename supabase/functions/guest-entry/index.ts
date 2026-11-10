import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.3/cors";
import { ageAllowed, guestHandle } from "../_shared/visitor.ts";
const reply = (body: object, status=200) => new Response(JSON.stringify(body), {status,headers:{...corsHeaders,"Content-Type":"application/json"}});
Deno.serve(async req => {
 if(req.method==='OPTIONS') return new Response(null,{headers:corsHeaders});
 if(req.method!=='POST') return reply({error:'Method not allowed'},405);
 let created: string | undefined;
 const url=Deno.env.get('SUPABASE_URL') ?? '';
 const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
 try {
  const input=await req.json();
  if(typeof input.birthday!=='string' || !ageAllowed(input.birthday)) return reply({error:'You must be at least 13 years old to enter AI-BOOM.'},400);
  const username=guestHandle();
  const email=`${crypto.randomUUID()}@guest.ai-boom.invalid`;
  const password=crypto.randomUUID()+crypto.randomUUID();
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username,display_name:username}});
  if(error || !data.user) throw new Error('Guest entry is unavailable. Please try again.');
  created=data.user.id;
  const {error:admissionError}=await admin.from('visitor_admissions').insert({user_id:created,is_guest:true});
  if(admissionError) throw admissionError;
  const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY') ?? '');
  const {data:login,error:loginError}=await client.auth.signInWithPassword({email,password});
  if(loginError || !login.session) throw new Error('Unable to sign in as guest');
  return reply({session:login.session});
 } catch {
  if(created) await admin.auth.admin.deleteUser(created);
  return reply({error:'Unable to enter as guest. Please try again.'},503);
 }
});