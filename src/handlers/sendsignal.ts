import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getStore, type AdminRecord, type SignalRecord } from "../store.js";

// Session shape for the sendsignal multi-step flow.
interface SignalSession {
  step?: "idle" | "awaiting_type" | "awaiting_target" | "awaiting_details";
  signal_type?: "public" | "premium";
  target?: "channel" | "dms" | "both";
}

type CtxWithSignal = Ctx & { session: SignalSession };

const composer = new Composer<Ctx>();

async function isAdmin(userId: number): Promise<boolean> {
  const store = getStore();
  const admin = await store.getAdmin(userId);
  return admin !== null;
}

function signalTypeKeyboard() {
  return inlineKeyboard([
    [inlineButton("🌐 Public", "signal:type:public"), inlineButton("⭐ Premium", "signal:type:premium")],
    [inlineButton("Cancel", "signal:cancel")],
  ]);
}

function signalTargetKeyboard() {
  return inlineKeyboard([
    [inlineButton("📢 Channel only", "signal:target:channel")],
    [inlineButton("💬 DMs only", "signal:target:dms")],
    [inlineButton("📢💬 Both", "signal:target:both")],
    [inlineButton("Cancel", "signal:cancel")],
  ]);
}

const DETAILS_PROMPT =
  "📝 Send the signal details in one message:\n\n" +
  "Symbol Direction Entry Stop-Loss Take-Profit Size Confidence Rationale\n\n" +
  "Example:\n" +
  "BTC LONG 65000 63500 68000 0.5 BTC 80% Key support hold at 64k";

composer.command("sendsignal", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) {
    await ctx.reply("⛔ You don't have permission to send signals.");
    return;
  }
  (ctx as CtxWithSignal).session.step = "awaiting_type";
  await ctx.reply("📡 New signal — what type?", { reply_markup: signalTypeKeyboard() });
});

composer.callbackQuery("signal:type:public", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) return;
  (ctx as CtxWithSignal).session.step = "awaiting_target";
  (ctx as CtxWithSignal).session.signal_type = "public";
  await ctx.editMessageText("🌐 Public signal selected.\n\nWhere should it go?", {
    reply_markup: signalTargetKeyboard(),
  });
});

composer.callbackQuery("signal:type:premium", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) return;
  (ctx as CtxWithSignal).session.step = "awaiting_target";
  (ctx as CtxWithSignal).session.signal_type = "premium";
  await ctx.editMessageText("⭐ Premium signal selected.\n\nWhere should it go?", {
    reply_markup: signalTargetKeyboard(),
  });
});

composer.callbackQuery(/^signal:target:(\w+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) return;
  const target = ctx.match[1] as "channel" | "dms" | "both";
  (ctx as CtxWithSignal).session.step = "awaiting_details";
  (ctx as CtxWithSignal).session.target = target;

  const targetLabel = target === "channel" ? "channel only" : target === "dms" ? "DMs only" : "channel + DMs";
  await ctx.editMessageText(`📤 Will send to ${targetLabel}.\n\n${DETAILS_PROMPT}`);
});

composer.callbackQuery("signal:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  (ctx as CtxWithSignal).session.step = "idle";
  await ctx.editMessageText("Signal cancelled. Tap /start to go back to the menu.");
});

// Handle free-text input when awaiting signal details.
composer.on("message:text", async (ctx, next) => {
  const session = (ctx as CtxWithSignal).session;
  if (session.step !== "awaiting_details") return next();

  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) {
    await ctx.reply("⛔ You don't have permission to send signals.");
    session.step = "idle";
    return;
  }

  const text = ctx.message.text.trim();
  // Parse: Symbol Direction Entry SL TP Size Confidence Rationale
  const parts = text.split(/\s+/);
  if (parts.length < 8) {
    await ctx.reply(
      "Couldn't parse that. Use this format:\n" +
        "SYMBOL DIRECTION ENTRY STOP-LOSS TAKE-PROFIT SIZE CONFIDENCE RATIONALE\n\n" +
        "Example:\n" +
        "BTC LONG 65000 63500 68000 0.5 BTC 80% Key support hold",
    );
    return;
  }

  const symbol = parts[0]!.toUpperCase();
  const direction = (parts[1]!.toUpperCase() as "LONG" | "SHORT");
  const entryPrice = parts[2]!;
  const stopLoss = parts[3]!;
  const takeProfit = parts[4]!;
  const size = parts.slice(5, 7).join(" ");
  const confidence = parts[7]!;
  const rationale = parts.slice(8).join(" ") || "No rationale provided";

  if (direction !== "LONG" && direction !== "SHORT") {
    await ctx.reply("Direction must be LONG or SHORT. Try again.");
    return;
  }

  const store = getStore();
  const signalType = session.signal_type ?? "public";
  const target = session.target ?? "both";

  const signal: SignalRecord = {
    symbol,
    direction,
    signal_type: signalType,
    timestamp: new Date().toISOString(),
    admin_id: userId,
    entry_price: entryPrice,
    stop_loss: stopLoss,
    take_profit: takeProfit,
    recommended_size: size,
    confidence_level: confidence,
    rationale,
  };

  await store.saveSignal(signal);

  const typeLabel = signalType === "premium" ? "⭐ Premium" : "🌐 Public";
  const targetLabel = target === "channel" ? "Channel" : target === "dms" ? "DMs" : "Channel + DMs";

  const confirmText =
    `✅ Signal saved!\n\n` +
    `${typeLabel} ${symbol} ${direction}\n` +
    `Entry: ${entryPrice} | SL: ${stopLoss} | TP: ${takeProfit}\n` +
    `Size: ${size} | Confidence: ${confidence}\n` +
    `Target: ${targetLabel}\n` +
    `Rationale: ${rationale}`;

  session.step = "idle";
  await ctx.reply(confirmText, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
