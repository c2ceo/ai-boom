import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

function Wheel({label,values,selected,onChange}:{label:string;values:{value:number;label:string}[];selected:number;onChange:(v:number)=>void}) {
 const ref=useRef<HTMLDivElement>(null);
 const timer=useRef<ReturnType<typeof setTimeout>>();
 useEffect(()=>{const index=values.findIndex(v=>v.value===selected);if(ref.current && index>=0) ref.current.scrollTop=index*36;},[selected,values.length]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 return <div className="min-w-0 flex-1"><span className="mb-1 block text-center text-xs text-welcome-muted">{label}</span>
  <div ref={ref} role="listbox" aria-label={label} tabIndex={0} className="birthday-wheel hide-scrollbar" onScroll={()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>{const index=Math.round((ref.current?.scrollTop ?? 0)/36);const item=values[index];if(item)onChange(item.value);},100);}} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const index=values.findIndex(v=>v.value===selected);const item=values[index+(e.key==='ArrowDown'?1:-1)];if(item)onChange(item.value);}}}>
   {values.map(item=><Button key={item.value} role="option" aria-selected={selected===item.value} variant="ghost" onClick={()=>onChange(item.value)} className={`birthday-wheel-item ${selected===item.value?'selected':''}`}>{item.label}</Button>)}
  </div>
 </div>;
}
export default function BirthdayWheel({onChange}:{onChange:(birthday:string)=>void}){
 const [year,setYear]=useState(new Date().getFullYear()-13);
 const [month,setMonth]=useState(1);
 const [day,setDay]=useState(1);
 const days=new Date(year,month,0).getDate();
 useEffect(()=>{const actual=Math.min(day,days);if(actual!==day)setDay(actual);onChange(`${year}-${String(month).padStart(2,'0')}-${String(actual).padStart(2,'0')}`);},[year,month,day,days]);
 return <div className="birthday-wheels" aria-label="Your birthday">
  <Wheel label="Month" values={Array.from({length:12},(_,i)=>({value:i+1,label:new Date(2000,i,1).toLocaleString('en',{month:'short'})}))} selected={month} onChange={setMonth}/>
  <Wheel label="Day" values={Array.from({length:days},(_,i)=>({value:i+1,label:String(i+1)}))} selected={Math.min(day,days)} onChange={setDay}/>
  <Wheel label="Year" values={Array.from({length:new Date().getFullYear()-1899},(_,i)=>({value:1900+i,label:String(1900+i)}))} selected={year} onChange={setYear}/>
 </div>;
}