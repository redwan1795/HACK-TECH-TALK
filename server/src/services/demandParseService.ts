import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { format, isValid, parseISO } from 'date-fns';
import { env } from '../config/env';

const client = new OpenAI({ apiKey: env.openaiApiKey });

const SYSTEM_PROMPT_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '../prompts/demandParseSystem.txt'),
  'utf-8'
);

function buildSystemPrompt(): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  const year = new Date().getFullYear().toString();
  return SYSTEM_PROMPT_TEMPLATE
    .replace(/\{\{TODAY\}\}/g, today)
    .replace(/\{\{YEAR\}\}/g, year);
}

const DEMAND_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'create_future_order',
    description: 'Parse a consumer demand into structured fields for a future order',
    parameters: {
      type: 'object',
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
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 512,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user',   content: query },
      ],
      tools: [DEMAND_TOOL],
      tool_choice: { type: 'function', function: { name: 'create_future_order' } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function') throw new DemandParseError('OpenAI returned no tool call');

    const input = JSON.parse(toolCall.function.arguments) as {
      product_keyword: string;
      quantity: number;
      unit: string;
      needed_by_date?: string;
      max_price_cents?: number;
      zip?: string;
      proximity_miles?: number;
    };

    // Validate ISO date — must be valid and in the future
    let needed_by_date: string | null = null;
    if (input.needed_by_date) {
      const parsed = parseISO(input.needed_by_date);
      needed_by_date = isValid(parsed) && parsed.getTime() > Date.now()
        ? input.needed_by_date
        : null;
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
    const isApiKeyError =
      err instanceof Error &&
      (err.message.includes('api_key') || err.message.includes('authentication') || err.message.includes('401'));
    throw new DemandParseError(
      isApiKeyError ? 'AI service is unavailable' : 'Failed to parse demand intent'
    );
  }
}
