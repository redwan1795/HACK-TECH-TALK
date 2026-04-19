import { http } from '../../shared/api/httpClient';

export interface ConfigRow { key: string; value: string; updated_at: string }

export interface Stats {
  usersByRole: { role: string; count: number }[];
  listings: { total: number; active: number; inactive: number };
  ordersByStatus: { status: string; count: number; revenue_cents: number }[];
  fees: { paid_orders: number; total_fees_cents: number };
  futureOrdersByStatus: { status: string; count: number }[];
}

export async function fetchConfig(): Promise<ConfigRow[]> {
  const { data } = await http.get<{ config: ConfigRow[] }>('/admin/config');
  return data.config;
}

export async function patchConfig(key: string, value: string): Promise<ConfigRow> {
  const { data } = await http.patch<{ config: ConfigRow }>('/admin/config', { key, value });
  return data.config;
}

export async function fetchStats(): Promise<Stats> {
  const { data } = await http.get<Stats>('/admin/stats');
  return data;
}
