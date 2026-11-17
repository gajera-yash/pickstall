import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

// The buyer's access email on a real MongoDB (founder bug report, 2026-11-17): the creator's own subject
// and message are used, the drawer shows whether it arrived, and a failed or cut-off send can be retried
// without ever sending a delivered email twice.

const mail = vi.hoisted(() => ({ emails: [] as { to: string; subject: string; text: string }[], fail: false }));

vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async (email: { to: string; subject: string; text: string }) => {
    if (mail.fail) throw new Error("Could not send the email.");
    mail.emails.push(email);
  }),
}));

import { collections } from "@/lib/db/collections";
import { sendOrderConfirmation } from "@/lib/orders/confirmation";
import { orderEmailStatus } from "@/lib/orders/email-status";
import { findOrderDetail } from "@/lib/orders/creator-queries";

import { seedOrder, seedProduct, seedStore } from "./fixtures";

beforeEach(() => {
  mail.emails.length = 0;
  mail.fail = false;
});

async function paidOrder() {
  const store = await seedStore({ name: "Maya's Studio" });
  const product = await seedProduct(store._id, {
    afterPurchase: { thankYou: null, redirectUrl: null, emailSubject: "Your {{product_title}} is here", emailBody: "Hi {{customer_name}}, enjoy! {{download_link}}" },
  });
  const order = await seedOrder(product, { buyerEmail: `buyer-${randomUUID().slice(0, 6)}@example.com`, buyerName: "Ravi" });
  return { store, product, order };
}

describe("order access email", () => {
  it("uses the creator's subject and message, with the access link, and records it as sent", async () => {
    const { store, product, order } = await paidOrder();
    expect(await sendOrderConfirmation(order._id)).toBe("sent");

    expect(mail.emails).toHaveLength(1);
    expect(mail.emails[0]?.to).toBe(order.buyerEmail);
    expect(mail.emails[0]?.subject).toBe(`Your ${product.title} is here`);
    expect(mail.emails[0]?.text).toMatch(/^Hi Ravi, enjoy! https?:\/\/\S+\/welcome\/\S+/);
    expect(mail.emails[0]?.text).toContain("Sent for Maya's Studio through Pickstall");

    expect((await orderEmailStatus(order._id))?.status).toBe("sent");
    expect((await findOrderDetail(store._id, order._id))?.accessEmail?.status).toBe("sent");
    // Never twice.
    expect(await sendOrderConfirmation(order._id)).toBe("skipped");
    expect(mail.emails).toHaveLength(1);
  });

  it("a failed send shows as failed and goes out on the next try", async () => {
    const { store, order } = await paidOrder();
    mail.fail = true;
    expect(await sendOrderConfirmation(order._id)).toBe("failed");
    expect((await findOrderDetail(store._id, order._id))?.accessEmail?.status).toBe("failed");

    mail.fail = false;
    expect(await sendOrderConfirmation(order._id)).toBe("sent");
    expect((await orderEmailStatus(order._id))?.attempts).toBe(2);
  });

  it("retries a send that was cut off long ago, but not one that may still be running", async () => {
    const { order } = await paidOrder();
    const { emailOutbox } = await collections();
    const key = `${order._id}:order-confirmation`;
    await emailOutbox.insertOne({ _id: key, orderId: order._id, kind: "order-confirmation", status: "sending", attempts: 1, createdAt: new Date(), sentAt: null });
    expect(await sendOrderConfirmation(order._id)).toBe("skipped");

    await emailOutbox.updateOne({ _id: key }, { $set: { createdAt: new Date(Date.now() - 11 * 60 * 1000) } });
    expect(await sendOrderConfirmation(order._id)).toBe("sent");
  });

  it("another store cannot see the email status of this order", async () => {
    const { order } = await paidOrder();
    const other = await seedStore();
    expect(await findOrderDetail(other._id, order._id)).toBeNull();
  });
});
