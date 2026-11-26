// Makes a VAPID key pair for browser push (D-132). Run `pnpm push:keys`, then paste both lines into
// Vercel (Settings > Environment Variables) and .env.local. Keep the private key secret; never commit it.
import { generateVAPIDKeys } from "web-push";

const keys = generateVAPIDKeys();
process.stdout.write(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`);
