import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for a form that waits on the request (query params or the signed-in user). */
export function LoginFormSkeleton({ label = "Loading the sign-in form", fields = 1 }: { label?: string; fields?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">{label}</span>
      <Skeleton className="-mt-3 mx-auto h-5 w-3/4" />
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
      <Skeleton className="h-13 w-full rounded-md" />
    </div>
  );
}
