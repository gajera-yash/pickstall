// Demo data for the buyer library in `pnpm dev:sandbox` (the throwaway in-memory database only):
//   node scripts/seed-sandbox.mjs <mongodb-uri-from-the-sandbox-log> [buyer email]
// Creates one creator store with a course (3 lessons, 1 done), a digital product and a booked
// coaching call, all bought by the buyer email. Refuses anything but a local in-memory URI.
import { randomUUID } from "node:crypto";

import { MongoClient } from "mongodb";

const [uri, email = "buyer@example.com"] = process.argv.slice(2);
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) {
  process.stderr.write("Pass the sandbox MongoDB URI (mongodb://127.0.0.1:<port>/...). Never a real database.\n");
  process.exit(1);
}

const client = new MongoClient(uri);
const db = client.db("pickstall_sandbox");
const now = new Date();
const day = 86_400_000;
const storeId = randomUUID();

const product = (type, title, slug, extra = {}) => ({
  _id: randomUUID(),
  storeId,
  type,
  title,
  slug,
  description: null,
  descriptionDoc: null,
  coverUrl: null,
  priceCents: 4900,
  salePriceCents: null,
  externalUrl: type === "digital" ? "https://example.com/guide.pdf" : null,
  deliveryType: "link",
  fileId: null,
  buttonText: "Buy now",
  downloadLimit: type === "digital" ? 5 : null,
  status: "published",
  checkout: { headline: null, askPhone: false, questions: [] },
  afterPurchase: { thankYou: null, redirectUrl: null, emailSubject: null, emailBody: null },
  sortOrder: 0,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
  ...extra,
});

const course = product("course", "Instagram Growth Masterclass", "instagram-growth", { course: { category: null, tags: [], accessDays: null, certificate: true } });
const guide = product("digital", "Content Calendar Template 2027", "content-calendar");
const call = product("coaching", "1:1 Strategy Call", "strategy-call", {
  coaching: { durationMinutes: 45, timeZone: "Asia/Kolkata", weekly: [], bufferMinutes: 0, minNoticeHours: 0, bookingWindowDays: 30, meetingUrl: "https://meet.example.com/maya" },
});

const order = (item, paidDaysAgo, extra = {}) => ({
  _id: randomUUID(),
  storeId,
  productId: item._id,
  item: { title: item.title, unitPriceCents: item.priceCents },
  buyerEmail: email,
  buyerName: "Riya Shah",
  buyerPhone: null,
  answers: [],
  subtotalCents: item.priceCents,
  discountCents: 0,
  totalCents: item.priceCents,
  currency: "usd",
  status: "paid",
  provider: "mock",
  providerSessionId: `mock_${item._id}`,
  providerPaymentId: `mockpay_${item._id}`,
  accessCount: 1,
  paidAt: new Date(now.getTime() - paidDaysAgo * day),
  createdAt: new Date(now.getTime() - paidDaysAgo * day),
  ...extra,
});

const start = new Date(now.getTime() + 3 * day);
start.setUTCHours(10, 0, 0, 0);
const end = new Date(start.getTime() + 45 * 60_000);

const courseOrder = order(course, 6);
const guideOrder = order(guide, 12);
const callOrder = order(call, 1, { booking: { start, end, buyerTimeZone: "Asia/Kolkata" } });

const moduleId = randomUUID();
const lessons = ["Welcome and how to use this course", "Find your niche in 20 minutes", "Write captions people save"].map((title, index) => ({
  _id: randomUUID(),
  storeId,
  productId: course._id,
  moduleId,
  title,
  sortOrder: index,
  video: { kind: "youtube", id: "dQw4w9WgXcQ" },
  bodyDoc: null,
  links: [],
  createdAt: now,
  updatedAt: now,
}));

try {
  await db.collection("stores").insertOne({
    _id: storeId,
    ownerId: randomUUID(),
    slug: "maya",
    name: "Maya Rao",
    bio: "I help creators grow on Instagram.",
    avatarUrl: null,
    socialLinks: [],
    theme: { preset: "clean", accent: "#0056FF" },
    currency: "usd",
    stripeAccountId: null,
    stripeChargesEnabled: false,
    isPublished: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection("products").insertMany([course, guide, call]);
  await db.collection("courseModules").insertOne({ _id: moduleId, storeId, productId: course._id, title: "Getting started", sortOrder: 0, dripDays: null, createdAt: now, updatedAt: now });
  await db.collection("lessons").insertMany(lessons);
  await db.collection("orders").insertMany([courseOrder, guideOrder, callOrder]);
  await db.collection("lessonProgress").insertOne({ _id: randomUUID(), orderId: courseOrder._id, storeId, productId: course._id, lessonId: lessons[0]._id, completedAt: now });
  await db.collection("bookings").insertOne({
    _id: randomUUID(),
    storeId,
    productId: call._id,
    orderId: callOrder._id,
    start,
    end,
    status: "confirmed",
    activeSlot: null,
    holdExpiresAt: null,
    confirmedAt: now,
    buyerTimeZone: "Asia/Kolkata",
    createdAt: now,
    updatedAt: now,
  });
  process.stdout.write(`Seeded 3 purchases for ${email}. Sign in at /login with that email; the code is in the dev server log.\n`);
} finally {
  await client.close();
}
