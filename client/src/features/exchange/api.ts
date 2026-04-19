import { http } from '../../shared/api/httpClient';

export interface Exchange {
  id: string;
  listingId: string;
  listingTitle: string;
  initiatorId: string;
  initiatorName: string;
  offeredItem: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  isOwner: boolean;
}

export async function listExchanges(): Promise<Exchange[]> {
  const { data } = await http.get<{ exchanges: Exchange[] }>('/exchanges');
  return data.exchanges;
}

export async function proposeExchange(listingId: string, offeredItem: string) {
  const { data } = await http.post('/exchanges', { listingId, offeredItem });
  return data.exchange;
}

export async function updateExchangeStatus(id: string, status: 'accepted' | 'declined') {
  const { data } = await http.patch(`/exchanges/${id}/status`, { status });
  return data;
}
