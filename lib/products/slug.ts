/**
 * Product link from a title: lowercase letters, numbers and hyphens, at most 50 characters. Pure, so
 * the editor can show the link a draft will get while the creator types (the server may add a short
 * suffix when another product of the store already uses it).
 */
export function slugFromTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  return slug || "product";
}

/**
 * The product link to show in the editor. A published product keeps its saved link. A draft's link
 * follows its title: the saved one when it already matches the title (it may carry a suffix), else
 * the one the title will give on the next save.
 */
export function shownProductSlug(status: string, savedSlug: string, title: string): string {
  if (status !== "draft") return savedSlug;
  const wanted = slugFromTitle(title);
  const suffixed = savedSlug.length === wanted.slice(0, 45).length + 5 && savedSlug.startsWith(`${wanted.slice(0, 45)}-`) && /-[0-9a-f]{4}$/.test(savedSlug);
  return savedSlug === wanted || suffixed ? savedSlug : wanted;
}
