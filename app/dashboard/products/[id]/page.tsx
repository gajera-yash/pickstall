import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CourseEditor, type EditorCourse } from "@/components/dashboard/course-editor";
import { ProductEditor, type EditorProduct } from "@/components/dashboard/product-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";
import { storeLink } from "@/lib/config";
import { findProductFile } from "@/lib/files/product-files";
import { centsToInput } from "@/lib/products/money";
import { docFromPlainText } from "@/lib/products/rich-text";
import { paymentsReady } from "@/lib/products/publish";
import { findProduct, isUnnamedDraft } from "@/lib/products/queries";
import { productIdInput } from "@/lib/products/schemas";

// Product editor (R3), or the course editor for a course (D-054). The product is looked up with the session owner's store id, so another
// creator's product id shows the same 404 as one that does not exist.
export default function ProductEditorPage({ params }: PageProps<"/dashboard/products/[id]">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorContent params={params} />
    </Suspense>
  );
}

async function EditorContent({ params }: Pick<PageProps<"/dashboard/products/[id]">, "params">) {
  const { id } = await params;
  const { store } = await requireCreator(`/dashboard/products/${id}`);
  if (!productIdInput.safeParse(id).success) notFound();

  const product = await findProduct(store.id, id);
  if (!product) notFound();
  // A product that has never been named is fresh from "Create": it opens on step 1 with no steps checked.
  const isNew = isUnnamedDraft(product);

  if (product.type === "course") {
    const course: EditorCourse = {
      id: product._id,
      status: product.status,
      title: product.title,
      descriptionDoc: product.descriptionDoc ?? docFromPlainText(product.description),
      coverUrl: product.coverUrl ?? "",
      category: product.course?.category ?? "",
      tags: product.course?.tags ?? [],
      pricing: product.priceCents > 0 ? "paid" : "free",
      price: product.priceCents > 0 ? centsToInput(product.priceCents, store.currency) : "",
      discountOn: product.salePriceCents != null,
      salePrice: centsToInput(product.salePriceCents ?? null, store.currency),
      access: product.course?.accessDays ? "days" : "lifetime",
      accessDays: product.course?.accessDays ? String(product.course.accessDays) : "",
    };
    return <CourseEditor initial={course} currency={store.currency} paymentsOk={paymentsReady(store)} isNew={isNew} />;
  }

  const initial: EditorProduct = {
    id: product._id,
    status: product.status,
    title: product.title,
    slug: product.slug,
    // Products saved before D-049 open with their plain description as paragraphs.
    descriptionDoc: product.descriptionDoc ?? docFromPlainText(product.description),
    coverUrl: product.coverUrl ?? "",
    externalUrl: product.externalUrl ?? "",
    // Products saved before D-050 deliver a link.
    deliveryType: product.deliveryType ?? "link",
    file: await findProductFile(store.id, product.fileId).catch(() => null),
    price: centsToInput(product.priceCents, store.currency),
    discountOn: product.salePriceCents != null,
    salePrice: centsToInput(product.salePriceCents ?? null, store.currency),
    buttonText: product.buttonText ?? "",
    downloadLimit: product.downloadLimit ? String(product.downloadLimit) : "",
    headline: product.checkout.headline ?? "",
    askPhone: product.checkout.askPhone,
    questions: product.checkout.questions,
    thankYou: product.afterPurchase.thankYou ?? "",
    redirectUrl: product.afterPurchase.redirectUrl ?? "",
    emailSubject: product.afterPurchase.emailSubject ?? "",
    emailBody: product.afterPurchase.emailBody ?? "",
  };

  return <ProductEditor initial={initial} currency={store.currency} storeLink={storeLink(store.slug)} paymentsOk={paymentsReady(store)} isNew={isNew} />;
}

function EditorSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading your product</span>
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-[560px] w-full rounded-lg" />
        <Skeleton className="hidden h-96 w-full rounded-lg xl:block" />
      </div>
    </div>
  );
}
