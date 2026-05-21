import axios from 'axios';
import { logInfo, logError } from './logger.js';

/**
 * AI-powered article analysis using OpenAI-compatible chat completions.
 */

let config = null;

/**
 * Initialize AI client with configuration
 * @param {Object} aiConfig - AI configuration from config.yaml
 */
export function initializeAI(aiConfig) {
  config = aiConfig;

  if (config.provider === 'openai' || config.provider === 'openai-compatible' || config.provider === 'openrouter') {
    assertProviderKey();
    logInfo(`AI initialized with ${config.provider} (model: ${config.model})`);
  } else {
    throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}

/**
 * Get the initialized AI client (for use in podcast generation)
 * @returns {Object} - AI client instance
 */
export function getAIClient() {
  throw new Error('Podcast generation needs an explicit TTS/LLM client adapter; generic OpenAI-compatible chat client is not enough.');
}

function providerBaseUrl() {
  if (config.provider === 'openrouter') return 'https://openrouter.ai/api/v1';
  return config.baseUrl || process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1';
}

function providerApiKey() {
  if (config.provider === 'openrouter') return config.apiKey || process.env.OPENROUTER_API_KEY;
  return config.apiKey || process.env.OPENAI_API_KEY;
}

function assertProviderKey() {
  if (!providerApiKey()) {
    const envName = config.provider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY';
    throw new Error(`Missing ${envName} for ${config.provider}`);
  }
}

function classifyProviderFailure(error) {
  const status = error.response?.status;
  const providerError = error.response?.data?.error ?? {};
  const providerMessage = providerError.message ?? error.response?.data?.message ?? '';
  const providerType = providerError.type ?? error.response?.data?.type ?? '';
  if ([401, 403].includes(status)) return `auth failure from ${config.provider} (${status})`;
  if (status === 429 && /insufficient[_ -]?quota|billing|credits/i.test(`${providerType} ${providerMessage}`)) {
    return `credit/billing failure from ${config.provider} (429)`;
  }
  if (status === 402) return `credit/billing failure from ${config.provider} (402)`;
  if (status === 429) return `rate limit from ${config.provider} (429)`;
  if (status) return `${config.provider} HTTP ${status}`;
  return error.message;
}

function isFatalProviderError(error) {
  return /auth failure|credit\/billing failure|rate limit/i.test(error.message);
}

export async function validateAIProvider() {
  await callLLM("Reply with ok.", "ok");
  logInfo(`AI provider preflight passed for ${config.provider}`);
}

function configuredModels() {
  return [config.model, ...(config.fallbackModels ?? [])].filter(Boolean);
}

/**
 * Call LLM with a prompt
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - User message
 * @returns {Promise<string>} - LLM response
 */
async function callLLM(systemPrompt, userPrompt) {
  if (config.provider === 'openai' || config.provider === 'openai-compatible' || config.provider === 'openrouter') {
    let lastError;
    for (const model of configuredModels()) {
      try {
        const response = await axios.post(
          `${providerBaseUrl().replace(/\/$/, '')}/chat/completions`,
          {
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 1024,
          },
          {
            headers: {
              'Authorization': `Bearer ${providerApiKey()}`,
              'Content-Type': 'application/json',
            },
            timeout: config.timeoutMs || 20000,
          }
        );
        if (model !== config.model) {
          logInfo(`AI model fallback succeeded with ${model}`);
        }
        return response.data.choices[0].message.content;
      } catch (error) {
        lastError = error;
        if (error.response?.status !== 404) break;
        logError(`AI model unavailable, trying fallback: ${model}`);
      }
    }
    throw new Error(classifyProviderFailure(lastError));
  }
  throw new Error(`Unknown provider: ${config.provider}`);
}

/**
 * Generate AI-powered summary for an article
 * @param {Object} item - Article item with title, content, link
 * @returns {Promise<string>} - 2-3 sentence summary
 */
export async function summarizeArticle(item) {
  const systemPrompt = `You are a technical news analyst specializing in AI, ML, audio/video processing, and emerging technologies.
Generate concise, insightful summaries that capture the key technical points and implications.
Your summaries should be 2-3 sentences maximum and focus on what matters to advanced developers and researchers.`;

  const userPrompt = `Summarize this article in 2-3 sentences:

Title: ${item.title}
Content: ${item.content ? item.content.substring(0, 1000) : 'No content available'}
Source: ${item.source}

Focus on technical details, novel approaches, and practical implications.`;

  try {
    const summary = await callLLM(systemPrompt, userPrompt);
    logInfo(`Generated summary for: ${item.title.substring(0, 50)}...`);
    return summary.trim();
  } catch (error) {
    logError(`Failed to summarize article: ${error.message}`);
    if (isFatalProviderError(error)) throw error;
    // Fallback to simple truncation
    return item.content
      ? item.content.substring(0, 300).replace(/\s+\S*$/, '') + '...'
      : item.title;
  }
}

/**
 * Score article's business viability as a solo developer opportunity
 * @param {Object} item - Article item
 * @returns {Promise<number>} - Viability score 0-100
 */
export async function scoreBusinessViability(item) {
  const systemPrompt = `You are a business analyst evaluating technology opportunities for solo advanced developers.
Rate each article's business viability from 0-100 based on MONETIZATION POTENTIAL.

Consider:
- Realistic revenue opportunity (MRR/ARR) within 12 months
- Market demand and willingness to pay
- Competitive landscape
- Monetization models (SaaS, API, tooling, consulting)

Scoring guide:
- 0-20: No clear monetization path or oversaturated market
- 21-40: Theoretical opportunity but high risk or unclear demand
- 41-60: Moderate opportunity, some validation needed
- 61-80: Strong opportunity with proven demand patterns
- 81-100: Exceptional opportunity with clear path to $5K+ MRR

Return ONLY a number from 0-100, nothing else.`;

  const userPrompt = `Rate the business viability of this technology/research:

Title: ${item.title}
Content: ${item.content ? item.content.substring(0, 1000) : 'No content available'}
Source: ${item.source}

Score (0-100):`;

  try {
    const scoreText = await callLLM(systemPrompt, userPrompt);
    const score = parseInt(scoreText.trim().match(/\d+/)?.[0] || '0', 10);
    const clampedScore = Math.max(0, Math.min(100, score));
    logInfo(`Business viability score for "${item.title.substring(0, 40)}...": ${clampedScore}`);
    return clampedScore;
  } catch (error) {
    logError(`Failed to score business viability: ${error.message}`);
    if (isFatalProviderError(error)) throw error;
    return 0; // Default to 0 on error
  }
}

/**
 * Score article's technical relevance to user's interests
 * @param {Object} item - Article item
 * @param {Array<string>} keywords - User's keyword interests
 * @returns {Promise<number>} - Relevance score 0-100
 */
export async function scoreTechnicalRelevance(item, keywords) {
  const systemPrompt = `You are a technical relevance analyst for an expert in AI, ML, audio/video processing, signal processing, and multimodal systems.
Rate each article's technical relevance from 0-100.

Consider:
- Alignment with user's core interests: ${keywords.join(', ')}
- Technical depth and novelty
- Practical applicability
- Research vs. product announcements (favor novel research)

Scoring guide:
- 0-20: Tangentially related or marketing fluff
- 21-40: Somewhat relevant but not core interest
- 41-60: Solid match to interests
- 61-80: Highly relevant to core expertise
- 81-100: Breakthrough or directly applicable to current work

Return ONLY a number from 0-100, nothing else.`;

  const userPrompt = `Rate the technical relevance:

Title: ${item.title}
Content: ${item.content ? item.content.substring(0, 1000) : 'No content available'}
Source: ${item.source}

Score (0-100):`;

  try {
    const scoreText = await callLLM(systemPrompt, userPrompt);
    const score = parseInt(scoreText.trim().match(/\d+/)?.[0] || '0', 10);
    const clampedScore = Math.max(0, Math.min(100, score));
    logInfo(`Technical relevance score for "${item.title.substring(0, 40)}...": ${clampedScore}`);
    return clampedScore;
  } catch (error) {
    logError(`Failed to score technical relevance: ${error.message}`);
    if (isFatalProviderError(error)) throw error;
    return 0; // Default to 0 on error
  }
}

/**
 * Analyze an article with AI: summary + both scores
 * @param {Object} item - Article item
 * @param {Array<string>} keywords - User's keyword interests
 * @returns {Promise<Object>} - Enhanced item with summary, viabilityScore, relevanceScore
 */
export async function analyzeArticle(item, keywords) {
  try {
    // Run all three AI calls in parallel for speed
    const [summary, viabilityScore, relevanceScore] = await Promise.all([
      summarizeArticle(item),
      scoreBusinessViability(item),
      scoreTechnicalRelevance(item, keywords),
    ]);

    return {
      ...item,
      summary,
      viabilityScore,
      relevanceScore,
    };
  } catch (error) {
    logError(`Failed to analyze article "${item.title}": ${error.message}`);
    if (isFatalProviderError(error)) throw error;
    // Return item with fallback values
    return {
      ...item,
      summary: item.content ? item.content.substring(0, 300).replace(/\s+\S*$/, '') + '...' : item.title,
      viabilityScore: 0,
      relevanceScore: 0,
    };
  }
}
