import { describe, expect, it, vi } from 'vitest';
import { finishGuestExit } from '../../supabase/functions/guest-exit/lifecycle';

describe('guest sign-out', () => {
  it('retains published posts under AI-Boom before deleting the guest account', async () => {
    const posts = [{ owner: 'guest', caption: 'Safe generated joke' }];
    let accountExists = true;
    await finishGuestExit({
      preserveContent: async () => { posts[0].owner = 'AI-Boom'; },
      removeGuestData: async () => { expect(posts[0].owner).toBe('AI-Boom'); },
      deleteIdentity: async () => { accountExists = false; },
    });
    expect(accountExists).toBe(false);
    expect(posts).toEqual([{ owner: 'AI-Boom', caption: 'Safe generated joke' }]);
  });
  it('keeps the account if published content cannot be preserved', async () => {
    const deleteIdentity = vi.fn();
    const removeGuestData = vi.fn();
    await expect(finishGuestExit({ preserveContent: async () => { throw new Error('Transfer failed'); }, removeGuestData, deleteIdentity })).rejects.toThrow('Transfer failed');
    expect(deleteIdentity).not.toHaveBeenCalled();
    expect(removeGuestData).not.toHaveBeenCalled();
  });
});