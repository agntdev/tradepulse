import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getStore } from "../store.js";

const composer = new Composer<Ctx>();

function unsubKeyboard(isOptedOut: boolean) {
  if (isOptedOut) {
    return inlineKeyboard([
      [inlineButton("🔔 Re-subscribe", "unsubscribe:toggle")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]);
  }
  return inlineKeyboard([
    [inlineButton("🔕 Unsubscribe from DMs", "unsubscribe:toggle")],
    [inlineButton("⬅️ Back to menu", "menu:main")],
  ]);
}

function unsubText(isOptedOut: boolean): string {
  if (isOptedOut) {
    return "🔕 You're unsubscribed from DM alerts.\n\nYou'll still see signals in the public channel. Tap below to re-subscribe.";
  }
  return "🔔 You're currently subscribed to DM alerts.\n\nTap below to stop receiving signal DMs (you'll still see them in the public channel).";
}

composer.command("unsubscribe", async (ctx) => {
  const store = getStore();
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Couldn't load your settings. Try /start first.");
    return;
  }
  const user = await store.getUser(userId);
  if (!user) {
    await ctx.reply("You're not registered yet. Tap /start to get started.");
    return;
  }
  await ctx.reply(unsubText(user.is_opted_out), {
    reply_markup: unsubKeyboard(user.is_opted_out),
  });
});

composer.callbackQuery("unsubscribe:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getStore();
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.editMessageText("Couldn't load your settings. Try /start first.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }
  const user = await store.getUser(userId);
  if (!user) {
    await ctx.editMessageText("You're not registered yet. Tap /start to get started.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }
  await ctx.editMessageText(unsubText(user.is_opted_out), {
    reply_markup: unsubKeyboard(user.is_opted_out),
  });
});

composer.callbackQuery("unsubscribe:toggle", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getStore();
  const userId = ctx.from?.id;
  if (!userId) return;

  const user = await store.getUser(userId);
  if (!user) return;

  user.is_opted_out = !user.is_opted_out;
  await store.saveUser(user);

  const statusText = user.is_opted_out
    ? "🔕 Done — you won't receive signal DMs anymore.\n\nYou'll still see signals in the public channel."
    : "🔔 Re-subscribed! You'll receive signal DMs again.";

  await ctx.editMessageText(statusText, {
    reply_markup: unsubKeyboard(user.is_opted_out),
  });
});

export default composer;
