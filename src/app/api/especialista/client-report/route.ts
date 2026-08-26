import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireRole } from '@/lib/server-roles';
import { getMaturityDimensions } from '@/lib/maturity-dimensions';
import { computeResults, type Answer, type DimensionAnswers } from '@/lib/maturity-scoring';
import { DIMENSION_IDS } from '@/lib/maturity-dimensions';

// GET /api/especialista/client-report?clientUid=XXX
// Returns the full maturity assessment data for a specific client,
// so the mentor can generate the PDF report client-side.
export async function GET(req: NextRequest) {
  const guard = await requireRole(req, 'especialista');
  if (guard instanceof NextResponse) return guard;

  const clientUid = req.nextUrl.searchParams.get('clientUid');
  if (!clientUid) {
    return NextResponse.json({ error: 'clientUid is required.' }, { status: 400 });
  }

  try {
    const db = getAdminDb();

    // Fetch latest assessment for the client
    const assSnap = await db
      .collection('assessments')
      .doc(clientUid)
      .collection('entries')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    if (assSnap.empty) {
      return NextResponse.json({ error: 'No assessment found for this client.' }, { status: 404 });
    }

    const ass = assSnap.docs[0].data() as Record<string, unknown>;
    const rawAnswers = ass.answers as Record<string, string[] | undefined> | undefined;
    const answers: DimensionAnswers = {} as DimensionAnswers;
    for (const id of DIMENSION_IDS) {
      answers[id] = ((rawAnswers?.[id] as string[] | undefined) ?? new Array(6).fill('no')).map(
        (a) => (a === 'yes' || a === 'partial' ? a : 'no')
      ) as Answer[];
    }

    const dimsEs = getMaturityDimensions('es');
    const dimsEn = getMaturityDimensions('en');
    const resultEs = computeResults(dimsEs, answers);
    const resultEn = computeResults(dimsEn, answers);

    // Fetch client name
    const userSnap = await db.collection('users').doc(clientUid).get();
    const userData = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};
    const clientName = (userData.name as string) ?? '';

    return NextResponse.json({
      clientUid,
      clientName,
      es: { result: resultEs, dimensions: dimsEs },
      en: { result: resultEn, dimensions: dimsEn },
    });
  } catch (err) {
    console.error('[especialista/client-report] error', err);
    return NextResponse.json({ error: 'Could not load client report.' }, { status: 500 });
  }
}
