/**
 * Gera URL otimizada de thumbnail para avatares do Supabase Storage.
 * Converte URLs de objeto público em URLs de renderização (transformação)
 * com tamanho reduzido, formato WebP e qualidade otimizada.
 *
 * Se a URL não for do Supabase Storage, retorna a URL original.
 */
export function getThumbnailUrl(
  url: string | null | undefined,
  size: number,
): string | null {
  if (!url) return null;

  // Apenas transforma URLs do Supabase Storage público
  const objectMarker = "/storage/v1/object/public/";
  const idx = url.indexOf(objectMarker);
  if (idx === -1) return url;

  const base = url.slice(0, idx);
  const rest = url.slice(idx + objectMarker.length);

  return (
    `${base}/storage/v1/render/image/public/${rest}` +
    `?width=${size}&height=${size}&resize=cover&quality=80&format=webp`
  );
}
