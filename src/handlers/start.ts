import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { getStore, type UserRecord } from "../store.js";

// Register main menu items — these become buttons on the /start menu.
registerMainMenuItem({ label: "📊 Status", data: "status:show", order: 20 });
registerMainMenuItem({ label: "🔕 Unsubscribe", data: "unsubscribe:show", order: 30 });

const WELCOME = "👋 Welcome! Tap a button below to get started.";

const composer = new Composer<Ctx>();

composer.command("start", async (ctx) => {
  const store = getStore();
  const userId = ctx.from?.id;
  if (userId) {
    const existing = await store.getUser(userId);
    if (!existing) {
      const now = new Date().toISOString();
      const user: UserRecord = {
        telegram_id: userId,
        username: ctx.from?.first_name ?? "User",
        is_premium: false,
        is_opted_out: false,
        registered_at: now,
        last_signal_received: null,
      };
      await store.saveUser(user);
    }
  }
  await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });
});

composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
