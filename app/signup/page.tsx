import type { Metadata } from "next";

import { SignupFlow } from "@/components/auth/signup-flow";
import { DASHBOARD_PATH } from "@/lib/auth/post-login";
import { APP_NAME } from "@/lib/config";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: `Create your account | ${APP_NAME}` };

export default function SignupPage() {
  return <SignupFlow googleNext={publicEnv.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" ? DASHBOARD_PATH : null} />;
}
