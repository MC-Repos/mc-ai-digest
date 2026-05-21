import { test, expect } from '@playwright/test';
import axios from 'axios';
import { consumeProviderWarnings, initializeAI, validateAIProvider } from '../src/ai.js';

const originalPost = axios.post;

test.afterEach(() => {
  axios.post = originalPost;
  consumeProviderWarnings();
});

test('falls back to the next configured model after quota failure', async () => {
  const calls = [];
  axios.post = async (_url, body) => {
    calls.push(body.model);
    if (body.model === 'openai/gpt-5.5') {
      const error = new Error('quota');
      error.response = {
        status: 429,
        data: {
          error: {
            type: 'insufficient_quota',
            message: 'quota exceeded',
          },
        },
      };
      throw error;
    }
    return { data: { choices: [{ message: { content: 'ok' } }] } };
  };

  initializeAI({
    provider: 'openrouter',
    model: 'openai/gpt-5.5',
    fallbackModels: ['google/gemini-2.5-pro'],
    apiKey: 'test-key',
  });

  await validateAIProvider();

  expect(calls).toEqual(['openai/gpt-5.5', 'google/gemini-2.5-pro']);
  expect(consumeProviderWarnings()).toEqual([
    'AI route failed, trying fallback: openai/gpt-5.5: credit/billing failure from openrouter (429)',
  ]);
});

test('does not fall back after auth failure', async () => {
  const calls = [];
  axios.post = async (_url, body) => {
    calls.push(body.model);
    const error = new Error('auth');
    error.response = { status: 401, data: { error: { message: 'bad key' } } };
    throw error;
  };

  initializeAI({
    provider: 'openrouter',
    model: 'openai/gpt-5.5',
    fallbackModels: ['google/gemini-2.5-pro'],
    apiKey: 'test-key',
  });

  await expect(validateAIProvider()).rejects.toThrow(
    'All AI model routes failed: openai/gpt-5.5: auth failure from openrouter (401)'
  );
  expect(calls).toEqual(['openai/gpt-5.5']);
  expect(consumeProviderWarnings()).toEqual([]);
});
