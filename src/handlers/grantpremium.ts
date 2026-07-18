import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getStore, type AdminRecord } from "../store.js";

const composer = new Composer<Ctx>();

async function isAdmin(userId: number): Promise<boolean> {
  const store = getStore();
  const admin = await store.getAdmin(userId);
  return admin !== null;
}

composer.command("grantpremium", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) {
    await ctx.reply("⛔ You don't have permission to manage premium access.");
    return;
  }

  const args = ctx.message?.text?.split(/\s+/).slice(1);
  const targetId = args?.[0] ? Number(args[0]) : NaN;

  if (!targetId || isNaN(targetId)) {
    await ctx.reply("Usage: /grantpremium <user_id>\n\nExample: /grantpremium 123456789");
    return;
  }

  const store = getStore();
  const user = await store.getUser(targetId);
  if (!user) {
    await ctx.reply(`User ${targetId} isn't registered yet. They need to tap /start first.`);
    return;
  }

  if (user.is_premium) {
    await ctx.reply(`User ${targetId} already has premium access.`);
    return;
  }

  user.is_premium = true;
  await store.saveUser(user);
  await ctx.reply(`✅ Premium access granted to ${targetId} (${user.username}).`);
});

composer.command("revokepremium", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) {
    await ctx.reply("⛔ You don't have permission to manage premium access.");
    return;
  }

  const args = ctx.message?.text?.split(/\s+/).slice(1);
  const targetId = args?.[0] ? Number(args[0]) : NaN;

  if (!targetId || isNaN(targetId)) {
    await ctx.reply("Usage: /revokepremium <user_id>\n\nExample: /revokepremium 123456789");
    return;
  }

  const store = getStore();
  const user = await store.getUser(targetId);
  if (!user) {
    await ctx.reply(`User ${targetId} isn't registered yet.`);
    return;
  }

  if (!user.is_premium) {
    await ctx.reply(`User ${targetId} doesn't have premium access.`);
    return;
  }

  user.is_premium = false;
  await store.saveUser(user);
  await ctx.reply(`✅ Premium access revoked from ${targetId} (${user.username}).`);
});

composer.command("listusers", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) {
    await ctx.reply("⛔ You don't have permission to list users.");
    return;
  }

  const store = getStore();
  const ids = await store.listUserIds();
  if (ids.length === 0) {
    await ctx.reply("No users registered yet.");
    return;
  }

  const lines: string[] = [];
  for (const id of ids) {
    const user = await store.getUser(id);
    if (user) {
      const premium = user.is_premium ? " ⭐" : "";
      const opted = user.is_opted_out ? " (opted out)" : "";
      lines.push(`${user.username} (${id})${premium}${opted}`);
    }
  }

  await ctx.reply(`👥 Registered users (${ids.length}):\n\n${lines.join("\n")}`);
});

export default composer;
