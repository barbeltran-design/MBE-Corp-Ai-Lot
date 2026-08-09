// Reflexión Estratégica en "vista enfocada" por fase:
// /babel/calibracion (Fase 0), /babel/proposito (Fase 1), /babel/entorno (Fase 2),
// /babel/capacidades (Fase 3) y /babel/enfoque (Fase 4).
// Cada mundo la usa para llevar al usuario directo a su información,
// separada del hilo completo de la Reflexión Estratégica (/babel).
import { BabelPageChat } from '@/components/babel/BabelPageChat';

const FASE_SLUGS: Record<string, number> = {
  calibracion: 0,
  proposito: 1,
  entorno: 2,
  capacidades: 3,
  enfoque: 4,
};

export function generateStaticParams() {
  return Object.keys(FASE_SLUGS).map((fase) => ({ fase }));
}

export default function BabelFasePage({ params }: { params: { fase: string } }) {
  const fase = FASE_SLUGS[params.fase];
  if (fase === undefined) return null;
  return <BabelPageChat faseInicial={fase} />;
}