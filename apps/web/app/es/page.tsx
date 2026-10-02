import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { StudioLanding } from '../../src/components/studio-landing';
import { canReadSession } from '../../src/lib/auth/can-read-session';
import { createServerSupabaseClient } from '../../src/lib/supabase/server';

export const metadata: Metadata = {
  title: { absolute: 'Must Be Viral, estudio de contenido en Houston' },
  description:
    'Contenido semanal para negocios de Houston: Reels, fotos y un calendario de publicación que sí se cumple.',
  alternates: { canonical: '/es', languages: { en: '/', es: '/es' } },
};

export default async function SpanishStudioPage() {
  if (canReadSession()) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getClaims();
    if (typeof data?.claims?.sub === 'string') redirect('/studio');
  }

  return <StudioLanding locale="es" />;
}
