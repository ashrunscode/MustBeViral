import type { Metadata } from 'next';

import { StudioLanding } from '../../src/components/studio-landing';

export const metadata: Metadata = {
  title: 'Must Be Viral',
  description:
    'Contenido semanal para negocios de Houston: Reels, fotos y un calendario de publicación que sí se cumple.',
};

export default function SpanishStudioPage() {
  return <StudioLanding locale="es" />;
}
