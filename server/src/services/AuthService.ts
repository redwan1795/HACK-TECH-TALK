import crypto from 'crypto';
import { pool } from '../db/pool';
import { hashPassword, verifyPassword } from '../utils/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  UserRole,
} from '../utils/jwt';
import { HttpError } from '../api/middlewares/errorHandler';

// In-memory refresh-token store — replaces Redis.
// Structure: tokenId -> { userId, expiresAt (ms) }
const refreshStore = new Map<string, { userId: string; expiresAt: number }>();

// Periodic cleanup of expired tokens (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of refreshStore) {
    if (entry.expiresAt < now) refreshStore.delete(id);
  }
}, 5 * 60 * 1000).unref();

const VALID_ROLES: UserRole[] = [
  'producer_home',
  'producer_farmer',
  'consumer',
  'broker',
];

export interface RegisterInput {
  email: string;
  password: string;
  role: UserRole;
  displayName?: string;
  locationZip?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    displayName: string | null;
  };
}

function makeTokens(userId: string, email: string, role: UserRole) {
  const tokenId = crypto.randomBytes(16).toString('hex');
  const accessToken = signAccessToken({ sub: userId, role, email });
  const refreshToken = signRefreshToken({ sub: userId, tokenId });

  // Store with expiry (7 days from now, matching JWT_REFRESH_EXPIRES_IN)
  refreshStore.set(tokenId, {
    userId,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  if (!VALID_ROLES.includes(input.role)) {
    throw new HttpError(400, 'INVALID_ROLE', `Role must be one of: ${VALID_ROLES.join(', ')}`);
  }

  if (input.password.length < 8) {
    throw new HttpError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters');
  }

  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, role, display_name, location_zip)
       VALUES (LOWER($1), $2, $3, $4, $5)
       RETURNING id, email, role, display_name`,
      [input.email, passwordHash, input.role, input.displayName ?? null, input.locationZip ?? null]
    );
    user = rows[0];
  } catch (err: any) {
    if (err.code === '23505') {
      throw new HttpError(409, 'EMAIL_EXISTS', 'An account with that email already exists');
    }
    throw err;
  }

  const { accessToken, refreshToken } = makeTokens(user.id, user.email, user.role);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
    },
  };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, role, display_name
     FROM users
     WHERE email = LOWER($1)
     LIMIT 1`,
    [email]
  );

  if (rows.length === 0) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const row = rows[0];
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const { accessToken, refreshToken } = makeTokens(row.id, row.email, row.role);

  return {
    accessToken,
    refreshToken,
    user: {
      id: row.id,
      email: row.email,
      role: row.role,
      displayName: row.display_name,
    },
  };
}

export async function refresh(refreshTokenStr: string): Promise<AuthResult> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenStr);
  } catch {
    throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token invalid or expired');
  }

  const entry = refreshStore.get(payload.tokenId);
  if (!entry || entry.userId !== payload.sub || entry.expiresAt < Date.now()) {
    throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token invalid or expired');
  }

  // Rotate: revoke old, issue new
  refreshStore.delete(payload.tokenId);

  const { rows } = await pool.query(
    `SELECT id, email, role, display_name FROM users WHERE id = $1 LIMIT 1`,
    [payload.sub]
  );
  if (rows.length === 0) {
    throw new HttpError(401, 'USER_NOT_FOUND', 'User no longer exists');
  }
  const user = rows[0];
  const { accessToken, refreshToken } = makeTokens(user.id, user.email, user.role);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
    },
  };
}

export function logout(refreshTokenStr: string): void {
  try {
    const payload = verifyRefreshToken(refreshTokenStr);
    refreshStore.delete(payload.tokenId);
  } catch {
    // Silent — logout always succeeds client-side
  }
}
