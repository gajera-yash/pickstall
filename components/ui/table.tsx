import * as React from "react"

import { cn } from "@/lib/utils"

// shadcn/ui table, restyled per DESIGN.md 9.9: header row on --bg-subtle with small uppercase muted
// labels, 64px rows with 1px separators, hover on --bg-subtle (D-102: one look for every table). Money cells use `TableCell` with
// `numeric` so they sit right-aligned in tabular figures.

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("bg-bg-subtle [&_tr]:border-b [&_tr]:border-line", className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn("border-b border-line transition-colors duration-(--dur-fast) hover:bg-bg-subtle", className)} {...props} />
}

function TableHead({ className, numeric, ...props }: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      data-slot="table-head"
      className={cn("h-11 px-4 text-left align-middle text-xs font-semibold tracking-wide whitespace-nowrap text-mute uppercase first:pl-5 last:pr-5", numeric && "text-right", className)}
      {...props}
    />
  )
}

function TableCell({ className, numeric, ...props }: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return <td data-slot="table-cell" className={cn("h-16 px-4 py-3 align-middle first:pl-5 last:pr-5", numeric && "text-right tabular-nums", className)} {...props} />
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
