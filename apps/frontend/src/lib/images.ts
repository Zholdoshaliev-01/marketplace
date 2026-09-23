export function isUsableProductImage(url: string | null | undefined): url is string {
  return Boolean(url && !url.includes('placehold.co'));
}
