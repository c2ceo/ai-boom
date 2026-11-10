import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
export function useMediaUrl(value?:string|null){
 const [url,setUrl]=useState<string|undefined>(value?.startsWith('private-media:') ? undefined : value ?? undefined);
 useEffect(()=>{
  let active=true;
  if(!value?.startsWith('private-media:')){setUrl(value ?? undefined);return;}
  setUrl(undefined);
  supabase.storage.from('private-media').createSignedUrl(value.slice('private-media:'.length),3600).then(({data})=>{if(active)setUrl(data?.signedUrl);});
  return ()=>{active=false;};
 },[value]);
 return url;
}