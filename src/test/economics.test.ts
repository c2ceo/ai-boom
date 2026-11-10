import { describe, expect, it } from 'vitest';
import { NET_USD_PER_CREDIT, creditsForCost } from '../../supabase/functions/_shared/economics';
describe('net revenue rules',()=>{
 it('allocates stated fees across the $1 50-credit pack',()=>expect(NET_USD_PER_CREDIT).toBeCloseTo(0.0124));
 it('returns at least 3.2 times Dev cost after fees',()=>expect(creditsForCost(.025)*NET_USD_PER_CREDIT).toBeGreaterThanOrEqual(.025*3.2));
 it('returns at least 3.2 times Pro cost after fees',()=>expect(creditsForCost(.04)*NET_USD_PER_CREDIT).toBeGreaterThanOrEqual(.04*3.2));
});