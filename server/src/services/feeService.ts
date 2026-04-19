import { pool } from '../db/pool';
import { env } from '../config/env';

// Platform fee read from platform_config.key = 'fee_percent'.
// Falls back to env default if missing.
export async function getFeePercent(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT value FROM platform_config WHERE key = 'fee_percent' LIMIT 1`
  );
  if (rows.length === 0) return env.DEFAULT_FEE_PERCENT;
  const parsed = parseFloat(rows[0].value);
  return Number.isFinite(parsed) ? parsed : env.DEFAULT_FEE_PERCENT;
}

export interface FeeBreakdown {
  subtotalCents: number;
  platformFeeCents: number;
  totalCents: number;
  feePercent: number;
}

export async function computeFee(subtotalCents: number): Promise<FeeBreakdown> {
  const feePercent = await getFeePercent();
  const platformFeeCents = Math.floor((subtotalCents * feePercent) / 100);
  return {
    subtotalCents,
    platformFeeCents,
    totalCents: subtotalCents + platformFeeCents,
    feePercent,
  };
}
