export function ageAllowed(birthday: string, today = new Date()): boolean {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return false;
 const date = new Date(`${birthday}T00:00:00Z`);
 if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== birthday || date.getUTCFullYear() < 1900) return false;
 const cutoff = new Date(Date.UTC(today.getUTCFullYear()-13, today.getUTCMonth(), today.getUTCDate()));
 return date <= cutoff;
}
export function guestHandle(): string {
 const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789_-';
 return 'guest' + Array.from(crypto.getRandomValues(new Uint8Array(10)), n => alphabet[n % alphabet.length]).join('');
}
export function guestModelAllowed(model: string, cost: number): boolean { return model === 'schnell' && cost === 0; }