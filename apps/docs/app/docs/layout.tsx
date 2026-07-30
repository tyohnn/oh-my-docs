import { DocsSidebarFolder } from '@oh-my-docs/ui/sidebar-folder';
import { DocsLayout } from '@oh-my-docs/ui/fumadocs';
import type { ReactNode } from 'react';

import { baseOptions } from '@/lib/layout.shared';
import { shouldUseSupabaseRemote, source as localSource } from '@/lib/source';
import { getSupabaseSource } from '@/lib/supabase-remote-source';

export default async function Layout({ children }: { children: ReactNode }) {
  const tree = shouldUseSupabaseRemote()
    ? (await getSupabaseSource()).source.getPageTree()
    : localSource.getPageTree();

  return (
    <DocsLayout
      tree={tree}
      sidebar={{ components: { Folder: DocsSidebarFolder } }}
      {...baseOptions()}
    >
      {children}
    </DocsLayout>
  );
}
