/**
 * M2 — Geocode Service tests
 * All tests mock Redis and axios — no real network or DB needed.
 */

const mockGet  = jest.fn();
const mockSet  = jest.fn().mockResolvedValue(undefined);
const mockGetDel = jest.fn().mockResolvedValue(null);
const mockDel  = jest.fn().mockResolvedValue(undefined);
const mockQuit = jest.fn().mockResolvedValue(undefined);

jest.mock('../db/redis', () => ({
  redisClient: {
    get:    mockGet,
    set:    mockSet,
    getDel: mockGetDel,
    del:    mockDel,
    quit:   mockQuit,
  },
}));

jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

import { getCoordinatesForZip } from '../services/geocodeService';

const LAS_CRUCES_RESPONSE = {
  data: {
    places: [
      {
        latitude: '32.3199',
        longitude: '-106.7637',
        'place name': 'Las Cruces',
        'state abbreviation': 'NM',
      },
    ],
  },
};

beforeEach(() => {
  mockGet.mockReset();
  mockSet.mockReset();
  mockSet.mockResolvedValue(undefined);
  mockedAxios.get.mockReset();
});

describe('getCoordinatesForZip', () => {
  it('returns lat/lng/city/state for valid US ZIP 88001', async () => {
    mockGet.mockResolvedValue(null);
    mockedAxios.get.mockResolvedValue(LAS_CRUCES_RESPONSE);

    const result = await getCoordinatesForZip('88001');

    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(32.3199);
    expect(result!.lng).toBeCloseTo(-106.7637);
    expect(result!.city).toBe('Las Cruces');
    expect(result!.state).toBe('NM');
  });

  it('returns null for unknown ZIP "00000"', async () => {
    mockGet.mockResolvedValue(null);
    mockedAxios.get.mockResolvedValue({ data: { places: [] } });

    const result = await getCoordinatesForZip('00000');
    expect(result).toBeNull();
  });

  it('caches result in Redis — second call does not hit Zippopotam.us', async () => {
    mockGet.mockResolvedValueOnce(null).mockResolvedValueOnce(
      JSON.stringify({ lat: 32.3199, lng: -106.7637, city: 'Las Cruces', state: 'NM' })
    );
    mockedAxios.get.mockResolvedValue(LAS_CRUCES_RESPONSE);

    await getCoordinatesForZip('88001');
    await getCoordinatesForZip('88001');

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('returns null when Zippopotam.us times out (axios rejects)', async () => {
    mockGet.mockResolvedValue(null);
    mockedAxios.get.mockRejectedValue(new Error('ETIMEDOUT'));

    const result = await getCoordinatesForZip('88001');
    expect(result).toBeNull();
  });

  it('stores result in Redis with 24h TTL on success', async () => {
    mockGet.mockResolvedValue(null);
    mockedAxios.get.mockResolvedValue(LAS_CRUCES_RESPONSE);

    await getCoordinatesForZip('88001');

    expect(mockSet).toHaveBeenCalledWith(
      'geocode:88001',
      expect.any(String),
      86400
    );
  });
});
