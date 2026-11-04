"use client";

import { ExternalLink, EyeOff, MoreHorizontal, Pencil, Rocket, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { changeProductStatus, removeProduct } from "@/lib/products/actions";

type Row = { id: string; title: string; status: "draft" | "published" | "archived"; publicPath: string | null };

/**
 * The "..." menu on a product row (D-059): Edit, View on store, Publish or Unpublish, Delete.
 * Delete asks first; a product with orders is hidden rather than removed, so its buyers keep access.
 * Publishing checks the same rules on the server as the editor.
 */
export function ProductRowActions({ product }: { product: Row }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const title = product.title.trim() || "Untitled product";

  const setStatus = (status: Row["status"]) =>
    start(async () => {
      const result = await changeProductStatus(product.id, status);
      if (!result.ok) setProblem(result.error);
      else router.refresh();
    });

  const remove = () =>
    start(async () => {
      const result = await removeProduct(product.id);
      if (!result.ok) {
        setProblem(result.error);
        setConfirming(false);
        return;
      }
      setConfirming(false);
      router.refresh();
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`Actions for ${title}`} className="shrink-0 rounded-full" loading={pending}>
            {!pending && <MoreHorizontal aria-hidden="true" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/products/${product.id}`}>
              <Pencil aria-hidden="true" />
              Edit
            </Link>
          </DropdownMenuItem>
          {product.status === "published" && product.publicPath && (
            <DropdownMenuItem asChild>
              <Link href={product.publicPath} target="_blank" rel="noopener">
                <ExternalLink aria-hidden="true" />
                View on store
              </Link>
            </DropdownMenuItem>
          )}
          {product.status === "published" ? (
            <DropdownMenuItem onSelect={() => setStatus("draft")}>
              <EyeOff aria-hidden="true" />
              Unpublish
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setStatus("published")}>
              <Rocket aria-hidden="true" />
              Publish
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirming(true)} className="text-danger focus:text-danger">
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{title}&rdquo;?</DialogTitle>
            <DialogDescription>It is removed from your store and your products. If anyone bought it, they keep access in their library and you keep the orders.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={remove} loading={pending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={problem !== null} onOpenChange={(open) => !open && setProblem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>That didn&apos;t work</DialogTitle>
            <DialogDescription className="sr-only">What went wrong</DialogDescription>
          </DialogHeader>
          <Alert variant="error">
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setProblem(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
