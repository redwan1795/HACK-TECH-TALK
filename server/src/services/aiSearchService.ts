import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { searchListings, ListingRow } from './listingService';

const client = new Anthropic({ apiKey: env.anthropicApiKey });

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, '../prompts/searchSystem.txt'),
  'utf-8'
);

const SEARCH_TOOL: Anthropic.Tool = {
  name: 'search_listings',
  description: 'Search produce listings by keyword, location, and filters',
  input_schema: {
    type: 'object' as const,
    properties: {
      keyword:      { type: 'string', description: 'Product name or type to search for' },
      category:     { type: 'string', enum: ['vegetable', 'fruit', 'flower', 'egg', 'other'] },
      zip:          { type: 'string', description: '5-digit US ZIP code for proximity search' },
      radius_miles: { type: 'number', description: 'Search radius in miles (default 25)' },
      max_price:    { type: 'number', description: 'Maximum price in cents' },
    },
    required: ['keyword'],
  },
};

export interface AISearchParams {
  query: string;
  userZip?: string;
}

export interface AISearchResult {
  intent: string;
  results: ListingRow[];
  explanation: string;
}

export async function aiSearch({ query, userZip }: AISearchParams): Promise<AISearchResult> {
  try {
    const userContent = userZip
      ? `User ZIP: ${userZip}\nQuery: ${query}`
      : `Query: ${query}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [SEARCH_TOOL],
      tool_choice: { type: 'tool', name: 'search_listings' },
      messages: [{ role: 'user', content: userContent }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );
    if (!toolUse) throw new Error('Claude returned no tool call');

    const input = toolUse.input as {
      keyword: string;
      category?: string;
      zip?: string;
      radius_miles?: number;
      max_price?: number;
    };

    const effectiveZip = input.zip ?? userZip;
    const { data: results } = await searchListings({
      q: input.keyword,
      zip: effectiveZip,
      radius_miles: input.radius_miles ?? (effectiveZip ? 25 : undefined),
      category: input.category,
    });

    const count = results.length;
    const explanation =
      count > 0
        ? `Found ${count} listing${count !== 1 ? 's' : ''} matching "${input.keyword}"${effectiveZip ? ` near ZIP ${effectiveZip}` : ''}.`
        : `No listings found for "${input.keyword}". Try broadening your search.`;

    return { intent: JSON.stringify(input), results, explanation };
  } catch {
    const { data: results } = await searchListings({ q: query, zip: userZip });
    return {
      intent: 'fallback',
      results,
      explanation: `Showing results for "${query}".`,
    };
  }
}
