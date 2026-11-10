import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Flame, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BirthdayWheel from '@/components/BirthdayWheel';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ageAllowed } from '../../supabase/functions/_shared/visitor';
import world from '@/assets/welcome-world.jpg';

export default function Welcome() {
 const [birthday,setBirthday]=useState('');
 const [entry,setEntry]=useState('guest');
 const [busy,setBusy]=useState(false);
 const [exploding,setExploding]=useState(false);
 const [error,setError]=useState('');
 const {user,refreshAdmission}=useAuth();
 const navigate=useNavigate();
 const reduced=useReducedMotion();
 const enter=async()=>{
  if(!ageAllowed(birthday)){setError('You must be at least 13 years old to enter AI-BOOM.');return;}
  setBusy(true);setError('');
  try {
   if(user){
    const {error}=await supabase.rpc('confirm_visitor_age',{p_birthday:birthday});
    if(error) throw error;
   } else if(entry==='account') {
    sessionStorage.setItem('aiboom_pending_birthday',birthday);
    navigate('/auth');return;
   } else {
    const {data,error}=await supabase.functions.invoke('guest-entry',{body:{birthday}});
    if(error || data?.error) throw new Error(data?.error || 'Guest entry is unavailable. Please try again.');
    const {error:sessionError}=await supabase.auth.setSession(data.session);
    if(sessionError) throw sessionError;
   }
   await refreshAdmission();
   setExploding(true);
   await new Promise(resolve=>setTimeout(resolve,reduced ? 0 : 650));
   navigate('/');
  } catch(e){setError(e instanceof Error ? e.message : 'Unable to enter. Please try again.');}
  finally{setBusy(false);}
 };
 return <main className="welcome-page">
  <section className="welcome-scene">
   <img src={world} width={1536} height={1024} alt="A red rocket among pink islands, turquoise seas and sculpted clouds" className="welcome-art" />
   <div className="welcome-shade" />
   <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
    <span className="flex items-center gap-2 text-lg font-bold"><Flame className="text-welcome-spark" /> AI-BOOM</span>
    <span className="text-xs text-welcome-muted">IMAGINATION, UNLEASHED.</span>
   </header>
   <div className="welcome-content">
    <div className="flex items-center gap-2 text-sm font-semibold text-welcome-mint"><Sparkles className="h-4 w-4" /> A million reasons to create</div>
    <h1 className="mt-4 text-6xl font-bold leading-none sm:text-7xl">AI-BOOM</h1>
    <p className="mt-5 max-w-md text-2xl font-semibold leading-tight">The first 1,000,000 AI photo generations are free.</p>
    <p className="mt-3 max-w-md text-sm leading-relaxed text-welcome-muted">Free FLUX Schnell generations, shared across the whole app. After the first million, just 1 credit per image.</p>
    <p className="mt-4 max-w-md text-base leading-relaxed">Anyone 13+ can browse, upload, and create without making an account. Just sign in as a guest.</p>
    <div className="mt-6 max-w-sm space-y-4">
     {!user && <div className="grid grid-cols-2 gap-2" aria-label="Entry method">
      <Button variant="outline" className={entry==='guest' ? 'welcome-choice selected' : 'welcome-choice'} onClick={()=>setEntry('guest')} aria-pressed={entry==='guest'}>Sign in as guest</Button>
      <Button variant="outline" className={entry==='account' ? 'welcome-choice selected' : 'welcome-choice'} onClick={()=>setEntry('account')} aria-pressed={entry==='account'}>Use an account</Button>
     </div>}
     <div className="space-y-2"><Label htmlFor="birthday" className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-welcome-mint" /> Your birthday</Label>
      <BirthdayWheel onChange={setBirthday}/>
      <p className="text-xs text-welcome-muted">You must be 13 or older. Your birthday is not saved.</p>
     </div>
     {error && <p role="alert" className="text-sm text-welcome-spark">{error}</p>}
     <div className="relative pt-3">
      {exploding && !reduced && <motion.div className="pointer-events-none absolute inset-0 rounded-full border-4 border-welcome-spark" initial={{scale:.4,opacity:1}} animate={{scale:2,opacity:0}} transition={{duration:.65}} />}
      <motion.div animate={exploding && !reduced ? {scale:[1,1.08,.95],rotate:[0,3,-3,0]} : {scale:1}} transition={{duration:.6}}>
       <Button className="dynamite-button" onClick={enter} disabled={busy || !birthday}>
        <span aria-hidden="true" className="dynamite-fuse"><Flame className="h-5 w-5 text-welcome-spark" /></span>
        {busy && !exploding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Flame className="h-5 w-5" />} Get to Boomin’
       </Button>
      </motion.div>
     </div>
     <p className="text-xs leading-relaxed text-welcome-muted">By entering, you agree to our <a href="/terms" className="underline">Terms</a> and <a href="/privacy-policy" className="underline">Privacy Policy</a>. Guest access stays on this browser; save an account to keep access.</p>
    </div>
   </div>
  </section>
  <section className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-6 py-6 text-sm"><span>Make something worth sharing.</span><span className="text-welcome-muted">AI art. Real community. Safe creativity.</span></section>
 </main>;
}