import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.3/cors";
import { z } from "npm:zod@3.25.76";
import { generateResponse, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.11";
import type {} from "../_shared/ai-gateway/models.d.ts";
import { IMAGE_MODELS } from "../_shared/image-models.ts";
import { guestModelAllowed } from "../_shared/visitor.ts";
const schema = z.object({ action: z.enum(["generate","enhance"]).default("generate"), prompt: z.string().trim().min(1).max(4000), model: z.enum(["schnell","dev","pro"]).default("dev"), request_id: z.string().uuid(), max_credits: z.number().int().min(0).max(11) });
const explicit = /\b(nude|naked|nsfw|porn|xxx|hentai|erotic|sexual|genitalia|explicit|uncensored|topless|bottomless|intercourse|orgasm|masturbat|fetish|bondage|bdsm)\b/i;
const reply = (body: object, status=200) => new Response(JSON.stringify(body), {status, headers:{...corsHeaders,"Content-Type":"application/json"}});
Deno.serve(async (req) => {
 if(req.method === "OPTIONS") return new Response(null,{headers:corsHeaders});
 if(req.method !== "POST") return reply({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL") ?? "";
 const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
 let reservedId: string | undefined;
 try {
  const auth=req.headers.get("Authorization");
  if(!auth?.startsWith("Bearer ")) return reply({error:"Please sign in"},401);
  const client=createClient(url,Deno.env.get("SUPABASE_ANON_KEY") ?? "");
  const {data:identity,error:authError}=await client.auth.getUser(auth.slice(7));
  if(authError || !identity.user) return reply({error:"Please sign in again"},401);
  const parsed=schema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success) return reply({error:"Invalid prompt or image request"},400);
  const input=parsed.data;
  const {data:admission}=await admin.from('visitor_admissions').select('is_guest').eq('user_id',identity.user.id).maybeSingle();
  const guest=admission?.is_guest === true;
  if(guest && !guestModelAllowed(input.model,input.max_credits)) return reply({error:'Guests can create free FLUX Schnell images during the shared promotion.'},403);
  if(explicit.test(input.prompt)) return reply({error:"Nudity and explicit content are prohibited",explicit_blocked:true},400);
  const key=Deno.env.get("FAL_API_KEY");
  if(input.action === "generate" && !key) return reply({error:"Image service unavailable"},503);
  const {data:r,error:reserveError}=await admin.rpc("reserve_image_request",{p_id:input.request_id,p_user:identity.user.id,p_model:input.action === "enhance" ? "enhance" : input.model,p_max_credits:input.max_credits});
  if(reserveError) return reply({error:reserveError.message,needs_credits:reserveError.message.includes("Not enough credits")},409);
  if(r.existing) {
   if(r.status === "completed") return reply(input.action === "enhance" ? {prompt:r.image_url} : {imageUrl:r.image_url,credits_used:r.credits});
   return reply({error:"This request is already running or failed; start a new request"},409);
  }
  reservedId=input.request_id;
  if(guest && r.credits !== 0) throw new Error('The free promotion has ended. Create an account to purchase credits.');
  if(input.action === "enhance") {
   const result=await generateResponse({model:"openai/gpt-6-astra",input:input.prompt,instructions:"Rewrite this image prompt for precise visual generation. Preserve every subject, number, quoted text, spatial relationship, requested style and exclusion. Add only compatible composition, lighting and material detail. Do not invent subjects or change intent. Return only the rewritten prompt, under 4000 characters. Never add nudity or explicit content."});
   const enhanced=result.output.flatMap(item=>item.type === "message" ? item.content.flatMap(part=>part.type === "output_text" ? [part.text] : []) : []).join("\n").trim();
   if(!enhanced || enhanced.length>4000 || explicit.test(enhanced)) throw new Error("Unable to enhance this prompt safely");
   const {error}=await admin.rpc("finish_image_request",{p_id:reservedId,p_success:true,p_url:enhanced});
   if(error) throw error;
   return reply({prompt:enhanced});
  }
  const response=await fetch(`https://fal.run/${IMAGE_MODELS[input.model].endpoint}`,{method:"POST",headers:{Authorization:`Key ${key}`,"Content-Type":"application/json"},body:JSON.stringify({prompt:input.prompt,image_size:"landscape_16_9",num_images:1,enable_safety_checker:true,...(input.model === "pro" ? {safety_tolerance:"1"} : {})})});
  if(!response.ok) throw new Error(`Image generation failed (${response.status})`);
  const data=await response.json();
  if(guest && (!Array.isArray(data.has_nsfw_concepts) || data.has_nsfw_concepts.length === 0)) throw new Error('Unable to confirm image safety; please try another prompt');
  if(data.has_nsfw_concepts?.some(Boolean)) throw new Error("Image blocked by safety checker");
  const imageUrl=data.images?.[0]?.url;
  if(!imageUrl) throw new Error("No image returned");
  const download=await fetch(imageUrl);
  if(!download.ok) throw new Error("Image download failed");
  const bytes=new Uint8Array(await download.arrayBuffer());
  const contentType=download.headers.get("content-type") || "image/jpeg";
  const path=`${identity.user.id}/generated/${input.request_id}.${contentType.includes("png") ? "png" : "jpg"}`;
  const {error:uploadError}=await admin.storage.from("media").upload(path,bytes,{contentType});
  if(uploadError) throw uploadError;
  const {data:publicUrl}=admin.storage.from("media").getPublicUrl(path);
  const {error:verifyError}=await admin.from("verified_media").insert({media_url:publicUrl.publicUrl,user_id:identity.user.id});
  if(verifyError) throw verifyError;
  if(guest) {
   const {error:safetyError}=await admin.from('safe_media').upsert({media_url:publicUrl.publicUrl,user_id:identity.user.id});
   if(safetyError) throw safetyError;
  }
  const {error:finishError}=await admin.rpc("finish_image_request",{p_id:reservedId,p_success:true,p_url:publicUrl.publicUrl});
  if(finishError) throw finishError;
  return reply({imageUrl:publicUrl.publicUrl,model:input.model,credits_used:r.credits});
 } catch(error) {
  if(reservedId) { const {error:refundError}=await admin.rpc("finish_image_request",{p_id:reservedId,p_success:false}); if(refundError) console.error("Image reservation recovery failed",reservedId); }
  if(error instanceof GatewayError) console.error("Prompt enhancement failed",error.code,error.ids);
  return reply({error:error instanceof GatewayError ? "Prompt enhancement unavailable; your prompt is unchanged" : error instanceof Error ? error.message : "Image request failed"},500);
 }
});
