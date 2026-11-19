// Messages for createProductAndEdit's ?error= codes, shown on the products list and the setup
// wizard's product step (D-079).
export const PRODUCT_CREATE_ERRORS: Record<string, string> = {
  limit: "You have reached the product limit for your store.",
  slow: "Slow down a little, then try again.",
  // Plan limits (D-098).
  plan_courses: "Your plan's course limit is reached. Upgrade to Pro for unlimited courses.",
  plan_coaching: "Coaching calls are part of Pro. Upgrade your plan to sell calls.",
  error: "Couldn't create the product. Check your connection and try again.",
};

export function productCreateError(code: unknown): string | undefined {
  return typeof code === "string" && Object.hasOwn(PRODUCT_CREATE_ERRORS, code) ? PRODUCT_CREATE_ERRORS[code] : undefined;
}

/** Where an editor goes after publishing (D-087): the products list, which then says it was published. */
export const PUBLISHED_HREF = "/dashboard/products?published=1";
