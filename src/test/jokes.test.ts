import { describe, expect, it } from 'vitest';
import { validJoke,jokeCredits,jokeCost,JOKE_FREE_BUDGET_USD } from '../../supabase/functions/_shared/jokes';
describe('joke rules',()=>{
 it('allows exactly 500 characters',()=>expect(validJoke('x'.repeat(500))).toBe(true));
 it('rejects 501 characters',()=>expect(validJoke('x'.repeat(501))).toBe(false));
 it('uses a shared $1000 budget',()=>expect(JOKE_FREE_BUDGET_USD).toBe(1000));
 it('is free before the budget is used',()=>expect(jokeCredits('cats',999)).toBe(0));
 it('quotes paid credits once $1000 is used',()=>expect(jokeCredits('cats',1000)).toBeGreaterThan(0));
 it('prices actual standard token usage',()=>expect(jokeCost(1000,100)).toBeCloseTo(.015));
});