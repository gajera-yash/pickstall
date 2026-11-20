import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

/** A GET search box for admin lists (works without JavaScript). */
export function AdminSearch({ action, q, placeholder, label }: { action: string; q?: string; placeholder: string; label: string }) {
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <InputGroup className="h-10 sm:w-96">
        <InputGroupInput type="search" name="q" aria-label={label} defaultValue={q ?? ""} maxLength={200} placeholder={placeholder} className="text-sm" />
        <InputGroupAddon>
          <Search aria-hidden="true" className="size-4" />
        </InputGroupAddon>
      </InputGroup>
      <Button type="submit" className="sr-only">
        Search
      </Button>
    </form>
  );
}
