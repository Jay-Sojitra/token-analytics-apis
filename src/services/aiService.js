const axios = require('axios');

const MODEL = process.env.Z_AI_MODEL || 'glm-5.1';

function buildPrompt(tokenData) {
  return `Analyze this cryptocurrency token market data and respond with valid JSON only.
Return a JSON object with exactly two fields:
- "reasoning": a 2-3 sentence market analysis string
- "sentiment": one of "Bullish", "Bearish", or "Neutral"

Token data:
${JSON.stringify(tokenData, null, 2)}

Respond only with the JSON object, no markdown, no code blocks.`;
}

function parseAIResponse(content) {
  // Strip markdown code fences if present
  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

async function getTokenInsight(tokenData) {
  const API_KEY = process.env.Z_AI_API_KEY;
  const BASE_URL = process.env.Z_AI_BASE_URL || 'https://api.z.ai/api/coding/paas/v4';

  if (!API_KEY) {
    return {
      reasoning: 'AI analysis unavailable — Z_AI_API_KEY not configured.',
      sentiment: 'Neutral',
    };
  }

  try {
    const { data } = await axios.post(
      `${BASE_URL}/chat/completions`,
      {
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a professional crypto market analyst. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: buildPrompt(tokenData),
          },
        ],
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = data.choices?.[0]?.message?.content || '';
    try {
      const parsed = parseAIResponse(content);
      if (typeof parsed.reasoning !== 'string' || typeof parsed.sentiment !== 'string') {
        throw new Error('Missing required fields');
      }
      const validSentiments = ['Bullish', 'Bearish', 'Neutral'];
      if (!validSentiments.includes(parsed.sentiment)) {
        parsed.sentiment = 'Neutral';
      }
      return parsed;
    } catch {
      return { reasoning: content, sentiment: 'Neutral' };
    }
  } catch (err) {
    if (err.response?.status === 401) {
      return { reasoning: 'AI analysis failed — invalid API key.', sentiment: 'Neutral' };
    }
    return { reasoning: 'AI analysis temporarily unavailable.', sentiment: 'Neutral' };
  }
}

module.exports = { getTokenInsight, MODEL };
