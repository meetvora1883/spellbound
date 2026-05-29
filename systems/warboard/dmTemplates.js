// systems/warboard/dmTemplates.js
const { formatMight, formatDateDisplay } = require('../../utils/dateUtils');

const templates = [
  // Template 1 – Standard
  (user, guildName, warDate, base, might) => 
    `⚔️ **WARBOARD ASSIGNMENT – CLAN WAR** ⚔️

Greetings **${user.username}**,

You have been **re-garrisoned** to **${base}** for the upcoming Clan War on **${formatDateDisplay(warDate)}** in **${guildName}**.

📋 **Your Details:**
• **Base:** ${base}
• **Might:** ${formatMight(might)}

Please report to your designated base on time and coordinate with your team.
~ Warboard Command`,

  // Template 2 – Formal
  (user, guildName, warDate, base, might) =>
    `📢 **OFFICIAL WARBOARD NOTIFICATION**

Dear **${user.username}**,

This is to inform you that you are assigned to **${base}** for the war on **${formatDateDisplay(warDate)}** in **${guildName}**.

**Assignment Details:**
- **Base:** ${base}
- **Might Requirement:** ${formatMight(might)}

Be ready 15 minutes before war start. Failure to attend may result in replacement.

Thank you for your cooperation.`,

  // Template 3 – Short & Punchy
  (user, guildName, warDate, base, might) =>
    `⚡ **WAR ALERT** ⚡

**${user.username}**, you're on **${base}** for **${formatDateDisplay(warDate)}**!

⚔️ **Base:** ${base}
💪 **Might:** ${formatMight(might)}

Don't be late! See you on the battlefield.`,

  // Template 4 – Encouraging
  (user, guildName, warDate, base, might) =>
    `🛡️ **TO ARMS, ${user.username}!** 🛡️

The clan needs your strength. You have been assigned to defend **${base}** during the war on **${formatDateDisplay(warDate)}** in **${guildName}**.

📊 **Your Stats:**
• **Base:** ${base}
• **Might:** ${formatMight(might)}

Together we are unstoppable!`,

  // Template 5 – Detailed
  (user, guildName, warDate, base, might) =>
    `📋 **WARBOARD UPDATE – ${guildName}**

Good day **${user.username}**,

Your presence is required at **${base}** for the upcoming conflict on **${formatDateDisplay(warDate)}**.

**─── ⋆⋅☆⋅⋆ ───**
**Base:** ${base}
**Might:** ${formatMight(might)}
**─── ⋆⋅☆⋅⋆ ───**

Please acknowledge this message with a ✅ reaction.
~ Warboard Staff`,

  // Template 6 – Casual
  (user, guildName, warDate, base, might) =>
    `Hey **${user.username}**! 👋

You've been assigned to **${base}** for the war on **${formatDateDisplay(warDate)}** in **${guildName}**.

**Might:** ${formatMight(might)}

Good luck, have fun! 🎮`,

  // Template 7 – Inspirational
  (user, guildName, warDate, base, might) =>
    `🌟 **A HERO RISES** 🌟

**${user.username}**, your valor is needed at **${base}**.

📅 **Date:** ${formatDateDisplay(warDate)}
🏰 **Guild:** ${guildName}
⚔️ **Might:** ${formatMight(might)}

History is written by warriors. Make yours legendary!`,

  // Template 8 – Minimalist
  (user, guildName, warDate, base, might) =>
    `**WARBOARD ASSIGNMENT**

**Player:** ${user.username}
**Base:** ${base}
**Date:** ${formatDateDisplay(warDate)}
**Might:** ${formatMight(might)}
**Guild:** ${guildName}

Report ASAP.`,

  // Template 9 – With Emojis
  (user, guildName, warDate, base, might) =>
    `⚔️ **━━━━━━━ ✠ ━━━━━━━** ⚔️
      **CLAN WAR DEPLOYMENT**
⚔️ **━━━━━━━ ✠ ━━━━━━━** ⚔️

🎖️ **Soldier:** ${user.username}
🏯 **Post:** ${base}
🗓️ **Date:** ${formatDateDisplay(warDate)}
📈 **Might:** ${formatMight(might)}
🏛️ **Guild:** ${guildName}

⚔️ **━━━━━━━ ✠ ━━━━━━━** ⚔️
*For the glory of the clan!*`,

  // Template 10 – Professional
  (user, guildName, warDate, base, might) =>
    `**WARBOARD COMMAND – OFFICIAL DISPATCH**

━━━━━━━━━━━━━━━━━━━━
**To:** ${user.username}
**From:** Warboard Command, ${guildName}
**Subject:** Battle Station Assignment
━━━━━━━━━━━━━━━━━━━━

You are hereby ordered to report to **${base}** on **${formatDateDisplay(warDate)}**.

**Might Requirement:** ${formatMight(might)}

Failure to comply may result in reassignment.
━━━━━━━━━━━━━━━━━━━━`,

  // Template 11 – Medieval Style
  (user, guildName, warDate, base, might) =>
    `🏰 **HEAR YE, HEAR YE!** 🏰

By order of the War Council of **${guildName}**,

**Sir ${user.username}** is summoned to defend the **${base}** on the **${formatDateDisplay(warDate)}**.

**Might:** ${formatMight(might)}

Godspeed, noble warrior!`,

  // Template 12 – Urgent
  (user, guildName, warDate, base, might) =>
    `🚨 **URGENT – WARBOARD UPDATE** 🚨

**${user.username}**, immediate confirmation required.

You are assigned to **${base}** (Might: ${formatMight(might)})
War Date: **${formatDateDisplay(warDate)}**
Guild: **${guildName}**

Please react with ✅ to confirm.`,

  // Template 13 – Friendly Reminder
  (user, guildName, warDate, base, might) =>
    `💬 **Quick Reminder from Warboard**

Hi **${user.username}**!

Just a heads-up that you're on **${base}** for the war on **${formatDateDisplay(warDate)}** in **${guildName}**.

**Might:** ${formatMight(might)}

See you there! 👊`,

  // Template 14 – Poetic
  (user, guildName, warDate, base, might) =>
    `🌅 **Before the Battle** 🌅

The drums of war echo through **${guildName}**.
**${user.username}**, your blade is needed at **${base}**.

**When:** ${formatDateDisplay(warDate)}
**Might:** ${formatMight(might)}

May your aim be true.`,

  // Template 15 – Tactical
  (user, guildName, warDate, base, might) =>
    `📊 **TACTICAL ASSIGNMENT BRIEF**

━━━━━━━━━━━━━━━
**OPERATION:** ${guildName} Clan War
**DATE:** ${formatDateDisplay(warDate)}
**ASSET:** ${user.username}
**POSITION:** ${base}
**POWER LEVEL:** ${formatMight(might)}
━━━━━━━━━━━━━━━

Acknowledge receipt. Over.`
];

/**
 * Returns a random DM template function
 */
function getRandomTemplate() {
  return templates[Math.floor(Math.random() * templates.length)];
}

module.exports = { getRandomTemplate };