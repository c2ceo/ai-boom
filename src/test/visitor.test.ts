import { describe, expect, it } from 'vitest';
import { ageAllowed, guestHandle, guestModelAllowed } from '../../supabase/functions/_shared/visitor';
describe('visitor rules', () => {
 const today=new Date('2026-11-10T01:15:00Z');
 it('allows someone on their thirteenth birthday',()=>expect(ageAllowed('2013-11-10',today)).toBe(true));
 it('rejects someone not yet thirteen',()=>expect(ageAllowed('2013-11-11',today)).toBe(false));
 it('rejects impossible birthdays',()=>expect(ageAllowed('2010-02-30',today)).toBe(false));
 it('generates guest plus ten safe random characters',()=>expect(guestHandle()).toMatch(/^guest[a-z0-9_-]{10}$/));
 it('allows free Schnell for guests',()=>expect(guestModelAllowed('schnell',0)).toBe(true));
 it('does not extend free guest generation beyond the promotion',()=>expect(guestModelAllowed('schnell',1)).toBe(false));
 it('does not allow paid models through guest creation',()=>expect(guestModelAllowed('dev',5)).toBe(false));
});