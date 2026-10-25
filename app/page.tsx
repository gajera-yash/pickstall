import { APP_NAME } from "@/lib/config";

// Placeholder until the marketing site and tenant routing land (Block B).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-2 p-6">
      <h1 className="text-3xl font-bold">{APP_NAME}</h1>
      <p>Setup in progress.</p>
    </main>
  );
}
