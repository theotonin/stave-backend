import crypto from 'node:crypto';
import prisma from '../config/database.js';
export const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
export async function createSession(userId) {
  const token=crypto.randomBytes(32).toString('base64url');
  await prisma.session.create({data:{userId,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+7*86400000)}});
  return token;
}
export async function sessionUser(token) {
  if (!token || !/^[\w-]{43}$/.test(token)) return null;
  const session=await prisma.session.findUnique({where:{tokenHash:tokenHash(token)}});
  return session && session.expiresAt > new Date() ? session.userId : null;
}
export async function revokeSession(token) {
  if(token) await prisma.session.deleteMany({where:{tokenHash:tokenHash(token)}});
}
export async function revokeOtherSessions(userId,currentToken) {
  await prisma.session.deleteMany({
    where: {
      userId,
      ...(currentToken && {tokenHash:{not:tokenHash(currentToken)}}),
    },
  });
}
export function publicUser(user) {
  if(!user) return user;
  const {password,login,...safe}=user;
  return safe;
}
