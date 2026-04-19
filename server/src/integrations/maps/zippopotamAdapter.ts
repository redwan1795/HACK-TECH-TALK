// Thin HTTP adapter over https://api.zippopotam.us (free, no key required).
export interface GeoResult {
  zip: string;
  lat: number;
  lng: number;
  placeName?: string;
  state?: string;
}

export async function zipToGeo(zip: string): Promise<GeoResult | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data: any = await res.json();
    const place = data?.places?.[0];
    if (!place) return null;
    return {
      zip,
      lat: parseFloat(place.latitude),
      lng: parseFloat(place.longitude),
      placeName: place['place name'],
      state: place['state abbreviation'],
    };
  } catch {
    return null;
  }
}
