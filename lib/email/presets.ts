// Ready-made texts for every email a creator can write (D-124). Picking one fills the subject and
// message; the creator can then change them. Each set uses only the variables its email allows
// (tests check this against each email's own rules). Plain text: the look adds the design.

export type EmailPreset = { id: string; name: string; subject: string; body: string };
export type EmailKind = "confirmation" | "welcome" | "broadcast" | "cart" | "review";

export const EMAIL_PRESETS: Record<EmailKind, EmailPreset[]> = {
  confirmation: [
    {
      id: "friendly",
      name: "Friendly",
      subject: "You're in, {{customer_name}}! 🎉",
      body: "Hi {{customer_name}},\n\nThank you so much for getting {{product_title}}. I made it with a lot of care and I hope you love it.\n\nOpen it any time here:\n{{download_link}}\n\nIf you have a question, just reply to this email.",
    },
    {
      id: "short",
      name: "Short and clear",
      subject: "Your {{product_title}} is ready",
      body: "Hi {{customer_name}},\n\nYour order is confirmed. Get {{product_title}} here:\n{{download_link}}",
    },
    {
      id: "course",
      name: "Course welcome",
      subject: "Welcome to {{product_title}}",
      body: "Hi {{customer_name}},\n\nWelcome aboard! You now have access to {{product_title}}.\n\nStart with the first lesson today, even if it is just 10 minutes:\n{{download_link}}\n\nSee you inside.",
    },
    {
      id: "next-step",
      name: "Thank you and next step",
      subject: "Thanks for your order, {{customer_name}}",
      body: "Hi {{customer_name}},\n\nThank you for trusting me with your purchase of {{product_title}}.\n\nYour next step: open it here and save it somewhere easy to find.\n{{download_link}}\n\nWhen you have tried it, I would love to hear what you think.",
    },
  ],
  welcome: [
    {
      id: "warm",
      name: "Warm welcome",
      subject: "Welcome, {{customer_name}}!",
      body: "Hi {{customer_name}},\n\nThanks for joining my list. I'm really glad you're here.\n\nI'll send you useful tips, new products and the occasional offer. No spam, ever.\n\nTalk soon!",
    },
    {
      id: "short",
      name: "Short hello",
      subject: "You're on the list",
      body: "Hi {{customer_name}},\n\nYou're in! Watch your inbox for my next email.",
    },
    {
      id: "story",
      name: "My story",
      subject: "A quick hello from me",
      body: "Hi {{customer_name}},\n\nWelcome! A little about me: I started this to share what I've learned the hard way, so you can skip the mistakes I made.\n\nReply and tell me what you're working on. I read every reply.",
    },
    {
      id: "gift",
      name: "Thank-you gift",
      subject: "Thanks for joining, {{customer_name}}",
      body: "Hi {{customer_name}},\n\nThank you for joining. As a thank you, keep an eye out: subscribers always hear about new products and special prices first.",
    },
  ],
  broadcast: [
    {
      id: "launch",
      name: "New product",
      subject: "Something new for you, {{customer_name}}",
      body: "Hi {{customer_name}},\n\nI just released something I've been working on for a while, and I think you'll find it useful.\n\nHere's what it helps you do:\n- First benefit\n- Second benefit\n- Third benefit\n\nTake a look in my store. Reply if you have any questions!",
    },
    {
      id: "sale",
      name: "Limited offer",
      subject: "A special price, just for my list",
      body: "Hi {{customer_name}},\n\nFor the next few days, everything in my store has a special price for subscribers.\n\nIf you've been thinking about it, now is a great time.",
    },
    {
      id: "tip",
      name: "Helpful tip",
      subject: "One quick tip for you",
      body: "Hi {{customer_name}},\n\nHere's one thing that made a big difference for me:\n\n(Write your tip here.)\n\nTry it this week and let me know how it goes.",
    },
    {
      id: "update",
      name: "News update",
      subject: "What's new this month",
      body: "Hi {{customer_name}},\n\nA quick update on what I've been up to:\n\n- Update one\n- Update two\n\nThanks for being here!",
    },
  ],
  cart: [
    {
      id: "gentle",
      name: "Gentle nudge",
      subject: "Still thinking about {{product_title}}?",
      body: "Hi {{customer_name}},\n\nI noticed you started checking out {{product_title}} but didn't finish. No pressure at all. It's still here when you're ready.",
    },
    {
      id: "help",
      name: "Can I help?",
      subject: "Any questions about {{product_title}}?",
      body: "Hi {{customer_name}},\n\nYou were so close to getting {{product_title}}! If something stopped you, a question or a payment problem, just reply and I'll help.",
    },
    {
      id: "short",
      name: "Short reminder",
      subject: "You left {{product_title}} behind",
      body: "Hi {{customer_name}},\n\nYour order of {{product_title}} isn't finished yet. You can complete it with one click.",
    },
  ],
  review: [
    {
      id: "friendly",
      name: "Friendly ask",
      subject: "How are you finding {{product_title}}?",
      body: "Hi {{customer_name}},\n\nYou got {{product_title}} a week ago. Would you take a minute to rate it? Your review helps other people decide.",
    },
    {
      id: "short",
      name: "One-minute review",
      subject: "Got a minute, {{customer_name}}?",
      body: "Hi {{customer_name}},\n\nCould you leave a quick rating for {{product_title}}? It takes less than a minute.",
    },
    {
      id: "personal",
      name: "Personal thank you",
      subject: "Thank you for getting {{product_title}}",
      body: "Hi {{customer_name}},\n\nThank you again for buying {{product_title}}. As a small creator, every review means a lot to me, and your honest opinion helps me make it better.",
    },
  ],
};
