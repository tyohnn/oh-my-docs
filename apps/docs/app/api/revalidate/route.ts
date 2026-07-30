import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { OMD_HANDBOOK_CACHE_TAG, handbookDocCacheTag } from '@/lib/handbook-cache';
import { isRevalidateAuthorized, readRevalidateSecret } from '@/lib/revalidate-auth';

export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
}

type RevalidateBody = {
  paths?: string[];
  tags?: string[];
};

/**
 * Secret-gated on-demand revalidation for supabase handbook reads.
 *
 * POST /api/revalidate
 * Authorization: Bearer $OMD_REVALIDATE_SECRET
 * Optional JSON: { "paths": ["plans/plan-x"], "tags": ["omd-doc:plans/plan-x"] }
 */
export async function POST(request: Request) {
  const expected = process.env.OMD_REVALIDATE_SECRET;
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'revalidate_secret_unset' }, { status: 503 });
  }
  const provided = readRevalidateSecret(request);
  if (!isRevalidateAuthorized(provided, expected)) return unauthorized();

  let body: RevalidateBody = {};
  try {
    body = (await request.json()) as RevalidateBody;
  } catch {
    body = {};
  }

  const tags = new Set<string>([OMD_HANDBOOK_CACHE_TAG, ...(body.tags ?? [])]);
  for (const path of body.paths ?? []) {
    if (typeof path === 'string' && path) tags.add(handbookDocCacheTag(path));
  }

  for (const tag of tags) {
    // Immediate expire for webhook/content-port callers (Next.js 16+).
    revalidateTag(tag, { expire: 0 });
  }
  revalidatePath('/docs', 'layout');
  revalidatePath('/md', 'layout');

  return NextResponse.json({
    ok: true,
    revalidated: {
      tags: [...tags],
      paths: ['/docs', '/md'],
    },
  });
}
