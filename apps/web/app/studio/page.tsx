import { redirect } from 'next/navigation';

import { requireStudioSession } from '../../src/lib/supabase/session-boundary';

export default async function StudioPage() {
  const session = await requireStudioSession();
  redirect(
    session.mode === 'local-preview' ? '/studio/lumen-skin/brief' : '/studio/campaign/brief',
  );
}
