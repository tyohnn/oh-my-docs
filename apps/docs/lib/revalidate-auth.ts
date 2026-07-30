export function readRevalidateSecret(request: Request): string | undefined {
  const header = request.headers.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  return request.headers.get('x-omd-revalidate-secret')?.trim() || undefined;
}

export function isRevalidateAuthorized(
  provided: string | undefined,
  expected: string | undefined,
): boolean {
  return Boolean(expected && provided && provided === expected);
}
