import { creditsForCost } from './economics.ts';
export const JOKE_FREE_BUDGET_USD=150;
export const JOKE_MAX_CHARACTERS=500;
export const JOKE_INPUT_LIMIT=8000;
export const JOKE_OUTPUT_TOKENS=1500;
// Standard Astra list rates, matched to the authenticated gateway catalog.
export function jokeCost(input:number,output:number,cached=0,cacheWrite=0){
 return Math.max(0,input-cached-cacheWrite)*.00001 + cached*.000001 + cacheWrite*.0000125 + output*.00005;
}
export function jokeQuote(prompt:string){return jokeCost(new TextEncoder().encode(prompt).length+1500,JOKE_OUTPUT_TOKENS);}
export function jokeCredits(prompt:string,spent:number){return spent<JOKE_FREE_BUDGET_USD ? 0 : creditsForCost(jokeQuote(prompt));}
export function validJoke(joke:string){return Array.from(joke).length>0 && Array.from(joke).length<=JOKE_MAX_CHARACTERS;}