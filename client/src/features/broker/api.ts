import { http } from '../../shared/api/httpClient';

export interface BrokerListing {
  id: string;
  title: string;
  category: string;
  priceCents: number;
  unit: string;
  quantityAvailable: number;
}

export interface AggregateProducer {
  producer_id: string;
  producer_name: string;
  producer_zip: string;
  licensed: boolean;
  listing_count: number;
  total_quantity: number;
  min_price_cents: number;
  max_price_cents: number;
  listings: BrokerListing[];
}

export async function fetchAggregate(): Promise<AggregateProducer[]> {
  const { data } = await http.get<{ producers: AggregateProducer[] }>('/broker/aggregate');
  return data.producers;
}
