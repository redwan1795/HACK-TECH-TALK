import axios from 'axios';
import { redisClient } from '../db/redis';

interface Coordinates {
  lat: number;
  lng: number;
  city: string;
  state: string;
}

const CACHE_TTL = 86400; // 24 hours

export async function getCoordinatesForZip(zip: string): Promise<Coordinates | null> {
  const cacheKey = `geocode:${zip}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached) as Coordinates;

  try {
    const { data } = await axios.get(`https://api.zippopotam.us/us/${zip}`, { timeout: 3000 });
    if (!data?.places?.length) return null;

    const place = data.places[0];
    const coords: Coordinates = {
      lat: parseFloat(place.latitude),
      lng: parseFloat(place.longitude),
      city: place['place name'],
      state: place['state abbreviation'],
    };

    await redisClient.set(cacheKey, JSON.stringify(coords), CACHE_TTL);
    return coords;
  } catch {
    return null;
  }
}
