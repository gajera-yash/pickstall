import { Skeleton } from "@/components/ui/skeleton";

/** Loading state while the login form waits for the request (page query params). */
export function LoginFormSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading the sign-in form</span>
      <Skeleton className="-mt-3 mx-auto h-5 w-3/4" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-12 w-full" />
      </div>
      <Skeleton className="h-13 w-full rounded-md" />
    </div>
  );
}
