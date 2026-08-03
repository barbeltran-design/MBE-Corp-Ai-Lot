// ─────────────────────────────────────────────────────────────────────────
// POST /api/perfil/foto
//
// Sube una foto de perfil a Cloudinary (plan gratuito) y regresa la URL
// pública. El navegador manda el archivo con su token de Firebase; el
// secreto de Cloudinary nunca sale del servidor (subida firmada).
//
// Variables de entorno requeridas (dashboard de Cloudinary):
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET
//
// Encabezado requerido:
//   Authorization: Bearer <token de Firebase del usuario logueado>
// Body: multipart/form-data con el campo `file`.
// ─────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAdminAuth } from '@/lib/firebase-admin';

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }
    const decoded = await getAdminAuth().verifyIdToken(idToken);

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      console.error('[perfil/foto] missing env: CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET');
      return NextResponse.json(
        { error: 'El servidor no tiene las variables de Cloudinary. Configúralas en Vercel (Production) y redeploy.' },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'La imagen pesa más de 5 MB.' }, { status: 400 });
    }
    const ext = file.name.split('.').pop() || 'jpg';
    if (!/^(jpg|jpeg|png|gif|webp)$/i.test(ext)) {
      return NextResponse.json({ error: 'Formato no permitido (usa jpg, png, gif o webp).' }, { status: 400 });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'profile-photos/' + decoded.uid;
    const toSign = 'folder=' + folder + '&timestamp=' + timestamp;
    const signature = createHash('sha1')
      .update(toSign + apiSecret)
      .digest('hex');

    const body = new FormData();
    body.append('file', file);
    body.append('api_key', apiKey);
    body.append('timestamp', String(timestamp));
    body.append('folder', folder);
    body.append('signature', signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body,
    });
    const result = await res.json();
    if (!res.ok || !result.secure_url) {
      const detail =
        result?.error?.message || JSON.stringify(result).slice(0, 300);
      console.error('[perfil/foto] cloudinary error', res.status, detail);
      return NextResponse.json(
        { error: 'Cloudinary rechazó la subida: ' + detail },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    console.error('[perfil/foto] failed', err);
    return NextResponse.json({ error: 'No se pudo subir la foto. Intenta de nuevo.' }, { status: 500 });
  }
}
