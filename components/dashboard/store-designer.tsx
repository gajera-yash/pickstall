"use client";

import { Eye, LayoutList, Palette, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { DesignCustomizer } from "@/components/dashboard/design-customizer";
import { DesignDraftProvider, useDesignDraft } from "@/components/dashboard/design-draft";
import { LiveStorePreview } from "@/components/dashboard/live-store-preview";
import { PageDesignForm } from "@/components/dashboard/page-design-form";
import { PageSectionsEditor } from "@/components/dashboard/page-sections-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PageBlock } from "@/lib/page-blocks/rules";
import type { StoreDesign } from "@/lib/store-design/rules";
import type { PublicProduct, PublicStore } from "@/lib/stores/public";

type Props = {
  store: PublicStore;
  products: PublicProduct[];
  isPublished: boolean;
  custom: StoreDesign | null;
  blocks: PageBlock[];
};

/**
 * Store design (D-125): its own page so designing is calm. The editor on the left in three tabs
 * (Theme, Customize, Sections), a large live preview on the right (a full-screen preview on
 * phones), and one Save button for everything that changed.
 */
export function StoreDesigner(props: Props) {
  const { store, custom, blocks } = props;
  return (
    <DesignDraftProvider saved={{ themePreset: store.theme.preset, accent: store.theme.accent, custom, blocks }}>
      <Designer {...props} />
    </DesignDraftProvider>
  );
}

function Designer({ store, products, isPublished, custom, blocks }: Props) {
  const router = useRouter();
  const draft = useDesignDraft();
  const [tab, setTab] = useState("theme");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const unsaved = draft?.unsaved ?? false;

  const shown: PublicStore = draft
    ? { ...store, theme: { preset: draft.design.themePreset, accent: draft.design.accent, custom: draft.design.custom }, pageBlocks: draft.design.blocks }
    : store;

  // Leaving with unsaved changes asks first (the browser shows its own message).
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const save = () =>
    startSave(async () => {
      setMessage(null);
      const ok = (await draft?.saveAll()) ?? true;
      if (ok) {
        setMessage({ kind: "success", text: "Saved. Your store page shows the new design." });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: "Some changes couldn't be saved. Check the message in the open tab, or the other tabs." });
      }
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-16 z-10 -mx-4 -mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display text-h2">Store design</h1>
          <p className="text-sm text-mute">Changes show in the preview right away. Save to publish them.</p>
        </div>
        <div className="flex items-center gap-2">
          {unsaved ? <Badge variant="testMode">Unsaved changes</Badge> : isPublished ? <Badge variant="live">Live</Badge> : <Badge variant="draft">Draft</Badge>}
          <Button type="button" variant="secondary" className="lg:hidden" onClick={() => setPreviewOpen(true)}>
            <Eye aria-hidden="true" className="size-4" />
            Preview
          </Button>
          <Button type="button" onClick={save} loading={saving} disabled={!unsaved}>
            Save
          </Button>
        </div>
      </div>

      {message && (
        <Alert variant={message.kind === "success" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-0 overflow-hidden rounded-xl border border-line bg-surface">
          <TabsList aria-label="Store design" className="px-4 sm:px-6">
            <TabsTrigger value="theme">
              <Palette aria-hidden="true" />
              Theme
            </TabsTrigger>
            <TabsTrigger value="customize">
              <SlidersHorizontal aria-hidden="true" />
              Customize
            </TabsTrigger>
            <TabsTrigger value="sections">
              <LayoutList aria-hidden="true" />
              Sections
            </TabsTrigger>
          </TabsList>
          {/* forceMount keeps each editor's unsaved work while another tab is open. */}
          <div className="p-5 sm:p-6">
            <TabsContent value="theme" forceMount className="data-[state=inactive]:hidden">
              <PageDesignForm initial={{ themePreset: store.theme.preset, accent: store.theme.accent }} />
            </TabsContent>
            <TabsContent value="customize" forceMount className="data-[state=inactive]:hidden">
              <DesignCustomizer initial={custom} />
            </TabsContent>
            <TabsContent value="sections" forceMount className="data-[state=inactive]:hidden">
              <PageSectionsEditor initial={blocks} />
            </TabsContent>
          </div>
        </Tabs>

        <aside aria-label="Live preview" className="hidden lg:sticky lg:top-[9.5rem] lg:block">
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
            <LiveStorePreview store={shown} products={products} maxHeight="calc(100dvh - 16rem)" scroll />
            <p className="text-center text-xs text-mute">Scroll inside the preview to see your whole page.</p>
          </div>
        </aside>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[min(1100px,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
            <DialogDescription>{unsaved ? "Your unsaved design. Save to publish it." : "How your store page looks to visitors."}</DialogDescription>
          </DialogHeader>
          <LiveStorePreview store={shown} products={products} maxHeight="70dvh" scroll />
        </DialogContent>
      </Dialog>
    </div>
  );
}
