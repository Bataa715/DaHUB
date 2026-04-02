export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { parseSchema } from '@/lib/schema-parser';
import DocsClient from './DocsClient';

export default function DocsPage() {
  const schema = parseSchema();
  return (
    <Suspense fallback={null}>
      <DocsClient schema={schema} />
    </Suspense>
  );
}
