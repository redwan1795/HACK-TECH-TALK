import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { isValid, parseISO } from 'date-fns';
import { env } from '../config/env';

const client = new Anthropic({ apiKey: env.anthropicApiKey });

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, '../prompts/demandParseSystem.txt'),
  'utf-8'
);

const DEMAND_TOOL: Anthropic.Tool = {
  name: 'create_future_order',
  description: 'Parse a consumer demand into structured fields for a future order',
  input_schema: {
    type: 'object' as const,
    properties: {
      product_keyword:  { type: 'string', description: 'Primary produce item, lowercase singular' },
      quantity:         { type: 'number', description: 'Amount needed' },
      unit:             { type: 'string', description: 'Unit of measure: lb, kg, dozen, unit, bunch, bag' },
      needed_by_date:   { type: 'string', description: 'ISO 8601 UTC datetime when produce is needed' },
      max_price_cents:  { type: 'number', description: 'Maximum price in cents' },
      zip:              { type: 'string', description: '5-digit US ZIP code from message' },
      proximity_miles:  { type: 'number', description: 'Search radius in miles, default 25' },
    },
    required: ['product_keyword', 'quantity', 'unit'],
  },
};

export interface DemandIntent {
  product_keyword: string;
  quantity:        number;
  unit:            string;
  needed_by_date:  string | null;
  max_price_cents: number | null;
  zip:             string | null;
  proximity_miles: number;
}

export class DemandParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DemandParseError';
  }
}

export async function parseDemandIntent(query: string): Promise<DemandIntent> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      tools: [DEMAND_TOOL],
      tool_choice: { type: 'tool', name: 'create_future_order' },
      messages: [{ role: 'user', content: query }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );
    if (!toolUse) throw new DemandParseError('Claude returned no tool call');

    const input = toolUse.input as {
      product_keyword: string;
      quantity: number;
      unit: string;
      needed_by_date?: string;
      max_price_cents?: number;
      zip?: string;
      proximity_miles?: number;
    };

    // Validate ISO date if present
    let needed_by_date: string | null = null;
    if (input.needed_by_date) {
      const parsed = parseISO(input.needed_by_date);
      needed_by_date = isValid(parsed) ? input.needed_by_date : null;
    }

    return {
      product_keyword:  input.product_keyword.toLowerCase().trim(),
      quantity:         input.quantity,
      unit:             input.unit,
      needed_by_date,
      max_price_cents:  input.max_price_cents ?? null,
      zip:              input.zip ?? null,
      proximity_miles:  input.proximity_miles ?? 25,
    };
  } catch (err) {
    if (err instanceof DemandParseError) throw err;
    // Don't leak raw API error details (e.g. Anthropic auth errors) to callers
    const isApiKeyError =
      err instanceof Error &&
      (err.message.includes('x-api-key') || err.message.includes('authentication_error'));
    throw new DemandParseError(
      isApiKeyError ? 'AI service is unavailable' : 'Failed to parse demand intent'
    );
  }
}
