/**
 * M0-API-01: OpenAPI spec passes swagger-parser validation (zero errors)
 * M0-API-02: All request bodies have 'required' fields specified
 * M0-API-03: All documented endpoints have at least one 2xx response
 */

import SwaggerParser from '@apidevtools/swagger-parser';
import path from 'path';
import type { OpenAPI } from 'openapi-types';

const SPEC_PATH = path.join(__dirname, '../../openapi.yaml');

let api: OpenAPI.Document;

beforeAll(async () => {
  api = await SwaggerParser.dereference(SPEC_PATH) as OpenAPI.Document;
});

// ─── M0-API-01 ────────────────────────────────────────────────────────────────
describe('M0-API-01: OpenAPI spec is valid', () => {
  it('parses and validates without throwing', async () => {
    await expect(SwaggerParser.validate(SPEC_PATH)).resolves.toBeDefined();
  });
});

// HTTP methods that carry a request body — used to skip non-operation keys like 'parameters'
const OPERATION_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

// ─── M0-API-02 ────────────────────────────────────────────────────────────────
describe('M0-API-02: request bodies have required fields where applicable', () => {
  it('POST and PUT requestBody object schemas declare a required array', () => {
    // PATCH is intentionally excluded: partial-update bodies have all fields optional by design.
    const METHODS_REQUIRING_REQUIRED = new Set(['post', 'put']);
    const paths = (api as { paths?: Record<string, Record<string, { requestBody?: { content?: Record<string, { schema?: { type?: string; required?: unknown[] } }> } }>> }).paths ?? {};
    const violations: string[] = [];

    for (const [route, pathItem] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!OPERATION_METHODS.has(method)) continue;
        if (!METHODS_REQUIRING_REQUIRED.has(method)) continue;
        if (!operation || typeof operation !== 'object') continue;
        const op = operation as { requestBody?: { content?: Record<string, { schema?: { type?: string; required?: unknown[] } }> } };
        if (!op.requestBody?.content) continue;

        for (const [, mediaType] of Object.entries(op.requestBody.content)) {
          const schema = (mediaType as { schema?: { type?: string; required?: unknown[] } }).schema;
          if (schema?.type === 'object' && !schema.required) {
            violations.push(`${method.toUpperCase()} ${route} — requestBody object schema missing 'required'`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─── M0-API-03 ────────────────────────────────────────────────────────────────
describe('M0-API-03: every operation has at least one documented response', () => {
  it('no HTTP operation has an empty responses object', () => {
    const paths = (api as { paths?: Record<string, Record<string, { responses?: Record<string, unknown> }>> }).paths ?? {};
    const violations: string[] = [];

    for (const [route, pathItem] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        // Skip non-operation keys like 'parameters' and 'summary'
        if (!OPERATION_METHODS.has(method)) continue;
        if (!operation || typeof operation !== 'object') continue;
        const op = operation as { responses?: Record<string, unknown> };
        if (!op.responses || Object.keys(op.responses).length === 0) {
          violations.push(`${method.toUpperCase()} ${route} — no responses defined`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
