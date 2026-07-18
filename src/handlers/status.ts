import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getStore } from "../store.js";

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

function formatStatus(isPremium: boolean, lastSignal: string | null): string {
  const premiumLabel = isPremium ? "Premium ✨" : "Standard";
  const lastSignalLine = lastSignal
    ? `Last signal: ${new Date(lastSignal).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
    : "No signals received yet.";
  return `📊 Your status\n\nPlan: ${premiumLabel}\n${lastSignalLine}`;
}

composer.command("status", async (ctx) => {
  const store = getStore();
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Couldn't load your status. Try /start first.");
    return;
  }
  const user = await store.getUser(userId);
  if (!user) {
    await ctx.reply("You're not registered yet. Tap /start to get started.");
    return;
  }
  await ctx.reply(formatStatus(user.is_premium, user.last_signal_received), {
    reply_markup: backToMenu,
  });
});

composer.callbackQuery("status:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getStore();
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.editMessageText("Couldn't load your status. Try /start first.", {
      reply_markup: backToMenu,
    });
    return;
  }
  const user = await store.getUser(userId);
  if (!user) {
    await ctx.editMessageText("You're not registered yet. Tap /start to get started.", {
      reply_markup: backToMenu,
    });
    return;
  }
  await ctx.editMessageText(formatStatus(user.is_premium, user.last_signal_received), {
    reply_markup: backToMenu,
  });
});

export default composer;
