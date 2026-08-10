import { NextResponse } from 'next/server';

const PROVIDERS = [
  { label: 'Groq', endpoint: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama3-70b-8192', key: process.env.FALLBACK_API_KEY },
  { label: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions', model: process.env.TERTIARY_MODEL || 'auto', key: process.env.TERTIARY_API_KEY },
  { label: 'DeepSeek', endpoint: (process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com/chat/completions'), model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', key: process.env.DEEPSEEK_API_KEY },
];

const TEST_MESSAGES = [
  { role: 'system', content: 'Responde solo "OK" en una palabra.' },
  { role: 'user', content: 'Di OK' },
];

async function testProvider(label: string, endpoint: string, model: string, apiKey: string | undefined) {
  const result = { label, hasKey: !!apiKey, status: 0, error: '', ok: false };
  if (!apiKey) { result.error = 'No API key'; return result; }
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: TEST_MESSAGES, temperature: 0.1, max_tokens: 10 }),
    });
    result.status = res.status;
    if (!res.ok) {
      result.error = (await res.text()).slice(0, 200);
    } else {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content ?? '';
      result.ok = text.length > 0;
      result.error = text.slice(0, 50);
    }
  } catch (e) {
    result.error = String(e).slice(0, 200);
  }
  return result;
}

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const result = { label: 'Gemini', hasKey: !!apiKey, status: 0, error: '', ok: false };
  if (!apiKey) { result.error = 'No API key'; return result; }
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Di OK' }] }],
        systemInstruction: { parts: [{ text: 'Responde solo "OK" en una palabra.' }] },
        generationConfig: { temperature: 0.1, maxOutputTokens: 10 },
      }),
    });
    result.status = res.status;
    if (!res.ok) {
      result.error = (await res.text()).slice(0, 200);
    } else {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
      result.ok = text.length > 0;
      result.error = text.slice(0, 50);
    }
  } catch (e) {
    result.error = String(e).slice(0, 200);
  }
  return result;
}

export async function GET() {
  const results = await Promise.all([
    ...PROVIDERS.map(p => testProvider(p.label, p.endpoint, p.model, p.key)),
    testGemini(),
  ]);
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    providers: results.map(r => ({
      provider: r.label,
      configured: r.hasKey,
      httpStatus: r.status,
      working: r.ok,
      detail: r.ok ? `Respuesta: "${r.error}"` : `Error: ${r.error.slice(0, 120)}`,
    })),
    env_check: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '✓ configurada' : '✗ faltante',
      FALLBACK_API_KEY: process.env.FALLBACK_API_KEY ? '✓ configurada' : '✗ faltante',
      TERTIARY_API_KEY: process.env.TERTIARY_API_KEY ? '✓ configurada' : '✗ faltante',
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? '✓ configurada' : '✗ faltante',
      TERTIARY_MODEL: process.env.TERTIARY_MODEL || '(usando default: openai/gpt-oss-20b:free)',
      GEMINI_MODEL: process.env.GEMINI_MODEL || '(usando default: gemini-2.5-flash)',
    },
  });
}
