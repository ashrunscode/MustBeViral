import { buildLlmsText } from '../../src/lib/llms-text';
import { publicOrigin } from '../../src/lib/public-origin';

export const dynamic = 'force-static';

export function GET() {
  return new Response(buildLlmsText(publicOrigin()), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
