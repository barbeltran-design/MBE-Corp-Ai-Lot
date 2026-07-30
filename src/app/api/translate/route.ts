import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type TranslateBody = {
  text: string;
  targetLang: 'es' | 'en';
};

async function tryGoogleTranslate(text: string, targetLang: 'es' | 'en'): Promise<string | null> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    'https://translation.googleapis.com/language/translate/v2?key=' + apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        target: targetLang,
        source: 'es',
        format: 'text',
      }),
    }
  );

  if (!res.ok) return null;

  const data = await res.json();
  const translated =
    data &&
    data.data &&
    data.data.translations &&
    data.data.translations[0] &&
    typeof data.data.translations[0].translatedText === 'string'
      ? data.data.translations[0].translatedText
      : null;

  return translated;
}

export async function GET() {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  let googleStatus = 'not_tested';
  let googleRaw: unknown = null;
  if (apiKey) {
    try {
      const res = await fetch(
        'https://translation.googleapis.com/language/translate/v2?key=' + apiKey,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: 'Hello', target: 'es', format: 'text' }),
        }
      );
      googleStatus = res.status.toString();
      googleRaw = await res.json();
    } catch (e) {
      googleStatus = 'fetch_error';
      googleRaw = e instanceof Error ? e.message : String(e);
    }
  }
  const present = !!apiKey;
  const prefix = apiKey ? apiKey.substring(0, 4) : '(none)';
  return NextResponse.json({
    GOOGLE_TRANSLATE_API_KEY: { present, prefix },
    google_response: { status: googleStatus, body: googleRaw },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TranslateBody;
    const text = (body && body.text ? body.text : '').toString();
    const targetLang = body && body.targetLang === 'en' ? 'en' : 'es';

    if (!text.trim()) {
      return NextResponse.json({ translation: text });
    }

    let translation: string | null = null;
    try {
      translation = await tryGoogleTranslate(text, targetLang);
    } catch {
      translation = null;
    }

    if (!translation) {
      return NextResponse.json(
        {
          error:
            'No se pudo traducir. Revisa que la variable GOOGLE_TRANSLATE_API_KEY este configurada en Vercel y que la Cloud Translation API este habilitada en tu proyecto de Google Cloud.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ translation: translation.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al traducir';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
