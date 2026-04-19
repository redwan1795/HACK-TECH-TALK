import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { redisClient } from '../db/redis';
import { env } from '../config/env';
import type { UserRole } from '@community-garden/types';

export interface TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtAccessTtl });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomUUID();
  const ttlSeconds = env.jwtRefreshTtlDays * 86_400;
  await redisClient.set(`refresh:${token}`, userId, ttlSeconds);
  return token;
}

export async function rotateRefreshToken(
  oldToken: string
): Promise<{ userId: string; newRefreshToken: string } | null> {
  const userId = await redisClient.getDel(`refresh:${oldToken}`);
  if (!userId) return null;
  const newRefreshToken = await issueRefreshToken(userId);
  return { userId, newRefreshToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await redisClient.del(`refresh:${token}`);
}
