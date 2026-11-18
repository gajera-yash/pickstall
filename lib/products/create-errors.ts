// Messages for createProductAndEdit's ?error= codes, shown on the products list and the setup
// wizard's product step (D-079).
export const PRODUCT_CREATE_ERRORS: Record<string, string> = {
  limit: "You have reached the product limit for your store.",
  slow: "Slow down a little, then try again.",
  error: "Couldn't create the product. Check your connection and try again.",
};

export function productCreateError(code: unknown): string | undefined {
  return typeof code === "string" && Object.hasOwn(PRODUCT_CREATE_ERRORS, code) ? PRODUCT_CREATE_ERRORS[code] : undefined;
}
