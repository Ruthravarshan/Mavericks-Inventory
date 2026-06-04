import { randomUUID } from "node:crypto";

interface AuditSession {
  userId: number;
  assetId: string;
  photoBuffer: Buffer | null;
  photoMime: string | null;
  expiresAt: Date;
}

const store = new Map<string, AuditSession>();

// Purge expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, s] of store) {
    if (s.expiresAt.getTime() < now) store.delete(token);
  }
}, 5 * 60_000).unref();

export function createSession(userId: number, assetId: string): { token: string; expiresAt: Date } {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60_000); // 10 min TTL
  store.set(token, { userId, assetId, photoBuffer: null, photoMime: null, expiresAt });
  return { token, expiresAt };
}

export function getSession(token: string): AuditSession | undefined {
  return store.get(token);
}

export function setSessionPhoto(token: string, buffer: Buffer, mime: string): boolean {
  const s = store.get(token);
  if (!s || s.expiresAt.getTime() < Date.now()) return false;
  s.photoBuffer = buffer;
  s.photoMime = mime;
  return true;
}
