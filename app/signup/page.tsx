import type { Metadata } from "next";

import { SignupFlow } from "@/components/auth/signup-flow";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Create your account | ${APP_NAME}` };

export default function SignupPage() {
  return <SignupFlow />;
}
