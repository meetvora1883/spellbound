/**
 * Forum guide definitions.
 * Each guide is an array of message objects.
 * Each message can have text and an optional image file.
 * Placeholders for emojis will be replaced at runtime.
 */

const replicaGuide = [
  {
    content: `{INFO} **Starperks and how they work**

{INFO} **Replica**

Replica, with enough combat talent to activate the perk, creates a copy of the hero with the highest combat talent on the mirrored enemy side (same column as your activated Replica perk is in).

⚙️ The merge level of the copy is limited to the merge level of your hero.

{INFO} **Example 1:**
Enemy hero: supermerge (merge lv 5), combat talent 36  
Your hero with Replica: merge lv 2, combat talent 20  

➡️ The copy will only be merge lv 2 with **70%** of the health, attack power, and ability strength of the original at that level.`,
    imagePath: null
  },
  {
    content: `{INFO} **Example 2:**
Enemy hero: merge lv 3, combat talent 70  
Your hero (with Replica): supermerge, combat talent 25  

➡️ The copy will only be merge lv 3.  
It depends on both your merge level and the enemy's merge level.

{ERROR} You cannot force a higher merge level just by increasing your own.

---

{INFO} **Why Replica is extremely strong**

Starting at perk level **60 (purple)**, Replica copies **ALL perks** from the enemy hero.

Even if you don’t own those perks, you still get them at full strength.

💥 This includes powerful perks like:
• Red tech orb  
• Lava (brand mine)  
• Other high-tier effects`,
    imagePath: null
  },
  {
    content: `💎 **Replica Level 100 Effect**

At level 100, the original enemy hero loses:
• ❤️ 30% health  
• ⚔️ 30% attack  
• ✨ 30% ability strength  

➡️ Per copy created.

🛡️ You can prevent the original from dying.

📊 There are 4 heroes possible per column.

---

📉 **Damage Reduction Formula**

Copy 1: 100% → 70%  
Copy 2: 70% → ~50%  
Copy 3: further reduced  

📌 The effect becomes weaker per copy but remains strong up to the 3rd copy.

⚠️ This reduction does NOT depend on your merge level.`,
    imagePath: null
  },
  {
    content: "🖼️ Example visualization",
    imagePath: "public/images/replica_image1.png"
  },
  {
    content: `🛡️ **How to defend against Replica**

There are 2 main ways:

---

⚠️ **1. Last chance option**
Use the spell **Torrent** and hope the enemy Replica lands away from your strongest heroes.

---

{SUCCESS} **2. Best option (recommended)**

Place a low merge (lv 2–3) hero with **HIGHER combat talent** in the same column as your main hero.

➡️ Result:
The enemy Replica will copy that weaker low-merge unit instead of your strong one.

---

{INFO} **Advanced protection**

If you want to protect key heroes (e.g., lava perk hero):

• Place another hero with higher combat talent in that column  

🎯 This ensures:
• Enemy copies wrong target  
• Your important perks are safe  
• You avoid self-damage from copied perks`,
    imagePath: null
  },
  {
    content: "📌 Strategy example",
    imagePath: "public/images/replica_image2.png"
  },
  {
    content: `📌 **Replica – Quick Summary**

• Copies enemy hero in same column  
• Merge level = limited by YOUR hero  
• Base copy = ~70% strength  
• Lv 60 → copies ALL perks 🔥  
• Lv 100 → reduces enemy stats per copy 💎  

🛡️ Best counter:
→ Place low merge + high combat talent hero in same column  

⚠️ Avoid letting enemy copy your main hero/perks`,
    imagePath: null
  }
];

const thunderveilGuide = [
  {
    content: `⚡ **Thunderveil – Starperk Guide**

The mechanic of **Thunderveil** is relatively simple compared to Replica.

---

🔹 **How it works**

Basically, it's a **damage boost perk** with some additional effects.

📌 **Activation condition:**
• You need enough combat talent  
• At least **one other hero alive** on your field  

➡️ This means:
At the start of the round, it is almost always active (unless only one hero type remains).

---

🔥 **Core Effect**

Thunderveil boosts:
• ⚔️ Your hero’s attack damage  
• 💥 ALL perks based on that damage  

➡️ This includes:
• Lava perk  
• Leper perk  
• Many other damage-based effects  

📌 The boost remains active **until only this hero type is left alive**.`,
    imagePath: null
  },
  {
    content: `👥 **Important interactions**

Other units also count as “alive heroes”:

• 🧟 Summons (e.g., from Muerta)  
• 🐒 Monkey King dummies  

➡️ These help keep Thunderveil active longer.

---

🚀 **Perk Levels & Bonuses**

🔸 **Lv 20**
• 🏃 Increased movement speed  
👉 Best used on **melee heroes**

---

🔸 **Lv 60**
• ⚡ +50% attack speed  

---

🔸 **Lv 100**
• 😨 5 sec fear on all enemies when effect ends  

⚠️ Note:
This effect is situational due to:
• Immunities  
• Protection perks  

➡️ May not always justify the high cost (90 gold runes)

---

🔥 **Best Use Case**

Thunderveil is especially strong for:

🌋 **Lava Pop users**

➡️ You get:
• Extra damage scaling  
• Strong boost even with low pop stacks`,
    imagePath: null
  },
  {
    
  },
  {
    content: `📌 **Thunderveil – Quick Summary**

• ⚡ Boosts hero attack + damage-based perks  
• 👥 Requires another hero alive  
• 🔥 Works with Lava, Leper, etc.  

🚀 Lv 20 → Movement speed  
⚡ Lv 60 → +50% attack speed  
😨 Lv 100 → Fear effect (situational)  

🧠 Best use:
→ Strong with **Lava Pop builds**  

⚠️ Keep other units alive to maintain the buff`,
    imagePath: null
  }
];

module.exports = {
  replica: replicaGuide,
  thunderveil: thunderveilGuide,
  // Add more guides here
};