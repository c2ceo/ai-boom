import { useEffect, useState } from 'react';
import { Laugh, Loader2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { jokeCredits,jokeQuote,JOKE_INPUT_LIMIT } from '../../supabase/functions/_shared/jokes';
import { useToast } from '@/hooks/use-toast';
export default function JokeCreator({onCaption}:{onCaption:(joke:string)=>void}){
 const [prompt,setPrompt]=useState('');const [joke,setJoke]=useState('');const [busy,setBusy]=useState(false);const [spent,setSpent]=useState<number|null>(null);
 const {toast}=useToast();
 const refresh=()=>supabase.from('joke_budget').select('spent_usd').eq('id',true).maybeSingle().then(({data,error})=>{if(!error)setSpent(Number(data?.spent_usd ?? 0));});
 useEffect(()=>{void refresh();},[]);
 const cost=jokeCredits(prompt,spent===null || spent+jokeQuote(prompt)>1000 ? 1000 : spent);
 const generate=async()=>{
  setBusy(true);
  try{
   const {data,error}=await supabase.functions.invoke('create-joke',{body:{prompt,request_id:crypto.randomUUID(),max_credits:cost}});
   if(error){const details=await error.context?.json?.().catch(()=>null);throw new Error(details?.error ?? error.message);}
   if(data?.error)throw new Error(data.error);
   setJoke(data.joke);toast({title:'Joke ready',description:data.credits_used ? `${data.credits_used} credits used` : 'Free'});
  }catch(e){toast({title:'Joke unavailable',description:e instanceof Error?e.message:'Try again later',variant:'destructive'});}
  finally{setBusy(false);void refresh();}
 };
 return <section className="my-5 space-y-3 border-y border-border py-5">
  <h2 className="flex items-center gap-2 font-semibold"><Laugh className="h-5 w-5 text-primary"/>AI Joke</h2>
  <Label htmlFor="joke-prompt">Joke topic</Label>
  <Textarea id="joke-prompt" placeholder="What should the joke be about?" value={prompt} onChange={e=>setPrompt(e.target.value)} rows={3}/>
  <p className="text-xs text-muted-foreground">Up to 250 characters per joke. {prompt.length.toLocaleString()} / 8,000 prompt characters.</p>
  <Button onClick={generate} disabled={busy || !prompt.trim() || prompt.length>JOKE_INPUT_LIMIT || spent===null} className="gap-2">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Laugh className="h-4 w-4"/>}{busy?'Writing…':`Write joke · ${cost===0?'Free':`up to ${cost} credits`}`}</Button>
  {joke && <div className="space-y-3"><p role="status" className="text-base leading-relaxed">{joke}</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>onCaption(joke)}>Use as caption</Button><Button variant="ghost" size="icon" aria-label="Copy joke" onClick={()=>navigator.clipboard.writeText(joke).then(()=>toast({title:'Joke copied'}))}><Copy className="h-4 w-4"/></Button></div></div>}
 </section>;
}