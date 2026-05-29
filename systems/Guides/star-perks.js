const path = require('path');
const emojis = require('../../constants/emojis');

function replaceEmojis(text) {
  if (!text) return text;
  return text
    .replace(/\{GREEN_TICK\}/g, emojis.GREEN_TICK || '✅')
    .replace(/\{RED_CROSS\}/g, emojis.RED_CROSS || '❌')
    .replace(/\{BAR_CHART\}/g, emojis.BAR_CHART || '📊')
    .replace(/\{LOCK\}/g, emojis.LOCK || '🔒')
    .replace(/\{UNLOCK\}/g, emojis.UNLOCK || '🔓')
    .replace(/\{TICKET\}/g, emojis.TICKET || '🎫')
    .replace(/\{CLOSE\}/g, emojis.CLOSE || '❌')
    .replace(/\{DELETE\}/g, emojis.DELETE || '🗑️')
    .replace(/\{CLAIM\}/g, emojis.CLAIM || '🙋')
    .replace(/\{UNCLAIM\}/g, emojis.UNCLAIM || '🙅')
    .replace(/\{ADD\}/g, emojis.ADD || '➕')
    .replace(/\{REMOVE\}/g, emojis.REMOVE || '➖')
    .replace(/\{TRANSCRIPT\}/g, emojis.TRANSCRIPT || '📄')
    .replace(/\{RENAME\}/g, emojis.RENAME || '✏️')
    .replace(/\{WARN\}/g, emojis.WARN || '⚠️')
    .replace(/\{INFO\}/g, emojis.INFO || 'ℹ️')
    .replace(/\{SUCCESS\}/g, emojis.SUCCESS || '✅')
    .replace(/\{ERROR\}/g, emojis.ERROR || '❌')
    .replace(/\{LOADING\}/g, emojis.LOADING || '⏳');
}

// ==================== REPLICA GUIDE ====================
const replicaMessages = [
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

// ==================== THUNDERVEIL GUIDE ====================
const thunderveilMessages = [
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
  // No content images
];

// ==================== TECH ORB GUIDE ====================
const techOrbMessages = [
  {
    content: `🔮 **Tech Orb – Starperk Guide**

Tech Orb is mainly a **damage-based perk**, but instead of dealing direct damage, it **reduces the maximum HP** of an enemy hero based on your hero’s attack power.

---

⚙️ **Core Mechanic**

• 💥 Reduces enemy **max HP**  
• ⚔️ Scaling depends on your hero’s **attack power**  
• 📉 Does NOT directly kill enemies  

➡️ Instead, it weakens them over time by shrinking their total HP pool.

---

💎 **Perk Level 100 (Key Feature)**

At **Lv 100**, Tech Orb becomes much stronger:

➡️ ❤️ The HP reduced from the enemy is **added to your hero**

📌 This means:
• You steal life from enemies  
• Your hero becomes tankier over time  

💡 The effect comes from the **shrink beam summon**`,
    imagePath: null
  },
  {
    content: `📜 **Important Rules**

🔹 **1. Cannot kill**
• Enemy HP can only go down to **1**  
• ❌ Cannot directly kill an enemy  

➡️ However:
You still gain **full HP value** based on your attack power

---

🎯 **2. Targeting**
• Completely **random target selection**

---

♻️ **3. No return after resurrection**
• Tech Orb effect does NOT come back after revive

---

🛡️ **Recommended Builds**

Tech Orb works best with:

• 🛡️ Strong defense perks  
• ❤️ Healing/sustain perks  

💡 Examples:
• Red Tech Golem  
• Verena  
• Vulcan  
• Aqua  

➡️ Without defense:
Your Tech Orb hero can be **one-shot**, making the perk useless

---

⚠️ **Weakness**

• Vulnerable to burst damage (e.g., Lava perk)  
• If killed early → you gain **no benefit**`,
    imagePath: null
  },
  {
    content: `🧠 **How to counter Tech Orb**

You have 3 main options:

---

🔥 **1. One-shot strategy**
• Kill Tech Orb hero instantly  
• Example: Lava perk, burst builds  

---

🧬 **2. Copy with Replica**
• Copy enemy Tech Orb hero  

➡️ Especially important if combined with:
• Red Tech Golem  

💡 Sometimes this is the ONLY counter

---

💚 **3. Outheal the effect**
• Use builds with faster life gain  

💡 Examples:
• Bunny + Bunny perk  
• Santa perk  

➡️ Gain HP faster than they steal it`,
    imagePath: null
  },
  {
    content: `📌 **Tech Orb – Quick Summary**

• 🔮 Reduces enemy max HP (cannot kill)  
• ⚔️ Scales with attack power  
• 💎 Lv 100 → Steals HP and adds to your hero  

⚠️ Weak vs burst damage  
🎯 Targets are random  

🛡️ Best with:
→ Defense + healing perks  

🧠 Counter:
• 🔥 One-shot it  
• 🧬 Copy with Replica  
• 💚 Outheal it`,
    imagePath: null
  }
  // No content images
];

// ==================== MANAFLOW GUIDE ====================
const manaflowMessages = [
  {
    content: `💧 **Manaflow – Star Perk Guide**

Manaflow is a **scaling perk** that increases ability strength **round-by-round** starting from the moment it is activated.

---

⚙️ **How it works**

Once your hero reaches enough combat talent:

➡️ The perk starts stacking **every round**

📌 Example:
• Round 2 → perk activated  
• Round 3 → 2 stacks  
• Round 4 → 3 stacks  

➡️ Stacks keep increasing in the background over time.

---

📌 **Important Detail**

Even if your hero cannot use abilities yet:

• ❌ Merge lv 1–2 → no abilities  
• ✅ Merge lv 3+ → abilities unlocked  

➡️ The stacks are still building from the moment the perk activates.

💡 So when you reach merge lv 3, you already have stacked power ready.

---

🔄 **Merging Behavior**

Stacks do NOT combine when merging.

📌 Example:
• Lv2 hero (3 stacks) + Lv2 hero (2 stacks)  
➡️ Lv3 hero = **3 stacks only**

❗ The higher stack is kept, not added.

---

🔥 **Playstyle Types**

Manaflow works differently depending on hero type:

---

⚔️ **1. Damage Heroes (Burst style)**

Examples:
• Witch  
• Friday  

➡️ High damage but fragile  
➡️ Like a **suicide squad** (deal damage then die)

---

🧟 **2. Summoning Heroes (Sustain style)**

Examples:
• Muerta  
• Bunny  

➡️ Build army over time  
➡️ Win through survival and scaling  

💡 Best synergy with Manaflow

---

👑 **Special Case – Pirate Queen**

• 💥 AoE damage + stun  
• 🧟 Summons  

➡️ Combines BOTH playstyles  
➡️ One of the strongest Manaflow users

---

🏆 **Top Heroes for Manaflow**

🥇 Pirate Queen  
🥈 Wizard (new astral)  
🥉 Muerta  
4️⃣ Friday  
5️⃣ Bunny  

📌 Note:
Hero level matters a lot  
➡️ High-level hero > low-level meta hero

---

🧠 **Deck Building Tips**

🔹 For summoners:
• 🛡️ Strong frontline  
• ⚡ Energy-generating perks  
➡️ Need time to scale army  

---

🔹 For damage heroes:
• ⚡ More energy perks  
• 🛡️ Frontline less important  

---

🔹 For Pirate Queen:
• Flexible build  
➡️ Can use either setup`,
    imagePath: null
  },
  {
    content: `📌 **Manaflow – Quick Summary**

• 💧 Gains stacks every round after activation  
• ⚡ Boosts ability strength over time  
• 🔓 Works even before abilities unlock  

🔄 Merge:
→ Stacks do NOT combine (highest stays)

🧠 Best users:
• 👑 Pirate Queen  
• 🧟 Muerta / Bunny  
• ⚔️ Friday / Witch  

⚙️ Strategy:
• Summoners → survive & scale  
• Damage heroes → burst fast  

🎯 Key:
→ Activate early for maximum stacks`,
    imagePath: null
  },
  {
    content: "🖼️ Example visualization",
    imagePath: "public/images/manaflow_image1.png"
  }
];

// ==================== ATMOSPHERIC SHIELD GUIDE ====================
const atmosphericShieldMessages = [
  {
    content: `🛡️ **Atmospheric Shield – Star Perk Guide**

Atmospheric Shield is a **defensive perk** that provides a strong shield at the start of every round.

---

⚙️ **Core Mechanic**

At the start of each round:

➡️ A **Shield** is created behind the hero  
➡️ Shield strength = **~178% of hero HP** (scales with upgrades)  

🛡️ The shield:
• Absorbs **ALL incoming damage**  
• Covers a **medium area**  

---

🔥 **Key Advantage**

• Protects your hero from burst damage  
• Allows safe scaling in early rounds  
• Extremely strong vs **Lava / burst builds**

---

📈 **Perk Levels & Effects**

🔸 **Lv 20**
• ⚔️ +20% damage for shielded allies  

---

🔸 **Lv 40**
• 📉 Battle Prowess requirement reduced to 15  

---

🔸 **Lv 60**
• 📏 Shield covers a **large area**  

---

🔸 **Lv 80**
• 📉 Battle Prowess requirement reduced to 10  

---

🔸 **Lv 100 (IMPORTANT)**
• 💥 When shield is destroyed:
→ Deals **20% of max HP as damage**
→ Hits **3 random enemies**

---

🧠 **How to Use Effectively**

✔️ Best for:
• 🧟 Summoners (Muerta, Bunny)  
• 🛡️ Tanky frontline heroes  
• ⏳ Long fights / scaling builds  

---

💡 **Strategy Tips**

• Keep hero alive → shield resets every round  
• Combine with **healing perks** for sustain  
• Use with **Manaflow / scaling perks**  

---

⚠️ **Weakness**

• ❌ Shield breaks quickly vs high burst damage  
• ❌ Random damage at Lv100 (not reliable targeting)  
• ❌ Less useful in very fast fights  

---

🛡️ **Best Synergy**

• ❤️ Healing perks (Verena, Aqua)  
• 🧟 Summon builds (to stall longer)  
• ⚡ Scaling builds (Manaflow, Tech Orb)

---

🎯 **Playstyle**

➡️ Defensive / sustain-focused  
➡️ Win by surviving longer than enemy

📌 **Atmospheric Shield – Quick Summary**

• 🛡️ Creates shield every round (~178% HP)  
• 💥 Absorbs all incoming damage  
• 📏 Large area at higher levels  

🔥 Lv100:
→ Shield explosion deals AoE damage  

🧠 Best for:
• 🧟 Summoners  
• 🛡️ Defensive builds  
• ⏳ Long fights  

⚠️ Weak vs:
• High burst damage  

🎯 Key:
→ Survive longer to gain advantage`,
    imagePath: null
  }
  // No content images
];

// ==================== ANTIMAGIC FIELD GUIDE ====================
const antimagicFieldMessages = [
  {
    content: `🧿 **Antimagic Field – Star Perk Guide**

Antimagic Field is a **control + damage perk** that weakens enemies and slows their energy gain.

---

⚙️ **Core Mechanic**

At the start of each round:

➡️ A **20s Antimagic Field** is placed  
➡️ Appears on the **enemy side (symmetrical position)**  

💥 Enemies inside the field:
• Take **damage per second** (based on your hero’s attack)  
• ⚡ Regenerate **50% slower energy**

---

🔥 **Key Advantage**

• Weakens enemy abilities over time  
• Slows energy generation (huge impact in longer fights)  
• Strong against **ability-dependent builds**

---

📈 **Perk Levels & Effects**

🔸 **Lv 20**
• 💥 Deals **2x damage to summons**

---

🔸 **Lv 40**
• 📉 Battle Prowess requirement reduced to 15  

---

🔸 **Lv 60**
• 😵 Applies **Madness debuff** to summons  

---

🔸 **Lv 80**
• 📉 Battle Prowess requirement reduced to 10  

---

🔸 **Lv 100 (IMPORTANT)**
• ⚡ Each affected enemy with full energy:
→ Restores **100 energy per second** to your hero  

➡️ Turns enemy energy into your advantage

---

🧠 **How to Use Effectively**

✔️ Best for:
• 🧟 Anti-summon builds  
• ⚡ Energy control strategies  
• ⏳ Long-duration fights  

---

💡 **Strategy Tips**

• Position matters → field is mirrored  
• Works best vs **summon-heavy enemies**  
• Combine with **damage-over-time perks**  

---

⚠️ **Weakness**

• ❌ Limited area (enemies can avoid it)  
• ❌ Not strong vs burst-only builds  
• ❌ Depends on enemy positioning  

---

🛡️ **Best Synergy**

• 🔮 Tech Orb (HP pressure + control)  
• 💧 Manaflow (long-term scaling)  
• 🛡️ Defensive perks (to stall longer)  

---

🎯 **Playstyle**

➡️ Control / disruption  
➡️ Win by weakening enemy over time

📌 **Antimagic Field – Quick Summary**

• 🧿 Creates field on enemy side (20s)  
• 💥 Deals damage over time  
• ⚡ Slows enemy energy regen  

🔥 Lv 20 → 2x vs summons  
😵 Lv 60 → Madness on summons  
⚡ Lv 100 → Converts enemy energy → your energy  

🧠 Best for:
• 🧟 Anti-summon  
• ⚡ Control builds  

⚠️ Weak vs:
• Burst builds  
• Mobile positioning  

🎯 Key:
→ Control enemy energy and abilities`,
    imagePath: null
  }
  // No content images
];

// ==================== FORCE FIELD GUIDE ====================
const forceFieldMessages = [
  {
    content: `🌀 **Force Field – Star Perk Guide**

Force Field is a **passive damage + control perk** that triggers periodically based on your hero’s HP.

---

⚙️ **Core Mechanic**

Once per second:

➡️ Deals damage based on your hero’s **max HP**  
➡️ Hits a **random nearby enemy**

💥 Damage scales with:
• ❤️ Your hero’s max HP  
• 📈 Buffs and upgrades  

---

🔥 **Key Advantage**

• Constant passive damage (no input needed)  
• Scales well with **tanky heroes**  
• Effective in **clustered fights**

---

📈 **Perk Levels & Effects**

🔸 **Lv 20**
• 💥 Damage also affects **nearby enemies** (AoE)

---

🔸 **Lv 40**
• 📉 Battle Prowess requirement reduced to 15  

---

🔸 **Lv 60**
• 🌀 Targets **3 enemies per hit**  

---

🔸 **Lv 80**
• 📉 Battle Prowess requirement reduced to 10  

---

🔸 **Lv 100 (IMPORTANT)**
• 💧 Full HP hero can apply **Slow** for 2s  

➡️ Adds control utility to the damage

---

🧠 **How to Use Effectively**

✔️ Best for:
• 🛡️ High HP (tank) heroes  
• 🧟 Frontline builds  
• ⏳ Long fights  

---

💡 **Strategy Tips**

• Increase max HP → increases damage  
• Keep hero alive → constant damage output  
• Combine with **healing perks**  

---

⚠️ **Weakness**

• ❌ Random targeting (not reliable focus)  
• ❌ Less effective in fast burst fights  
• ❌ Requires high HP to scale well  

---

🛡️ **Best Synergy**

• ❤️ Healing perks (Verena, Aqua)  
• 🛡️ Defensive builds  
• 💧 Manaflow (long fights)  

---

🎯 **Playstyle**

➡️ Passive damage dealer  
➡️ Tank-based sustain strategy

📌 **Force Field – Quick Summary**

• 🌀 Deals damage every second  
• ❤️ Scales with max HP  
• 💥 Hits random nearby enemies  

🔥 Lv 20 → AoE damage  
🌀 Lv 60 → Hits 3 targets  
💧 Lv 100 → Applies slow  

🧠 Best for:
• 🛡️ Tank heroes  
• ⏳ Long fights  

⚠️ Weak vs:
• Burst damage  
• Low HP builds  

🎯 Key:
→ Stack HP for higher damage`,
    imagePath: null
  }
  // No content images
];



// ==================== RESONANCE GUIDE ====================
const resonanceMessages = [
  {
    content: `🔷 **Resonance – Star Perk Guide**

Resonance is a **chain damage perk** that spreads damage across multiple identical enemies.

---

⚙️ **Core Mechanic**

Each attack:

➡️ Deals **enhanced damage** to main target  
➡️ Then spreads to up to **4 identical enemy heroes**

💥 Damage is based on your hero’s attack power  

📌 Only affects:
• Enemies of the **same type**

---

🔥 **Key Advantage**

• Strong vs **duplicate-heavy builds**  
• Punishes summon spam  
• Can hit multiple targets in one attack  

---

📈 **Perk Levels & Effects**

🔸 **Lv 20**
• 📈 Each additional identical target takes **+10% damage**

---

🔸 **Lv 40**
• 📉 Battle Prowess requirement reduced to 15  

---

🔸 **Lv 60**
• 💥 Chain damage increased to **20% per target**

---

🔸 **Lv 80**
• 📉 Battle Prowess requirement reduced to 10  

---

🔸 **Lv 100 (IMPORTANT)**
• 💣 Damage also hits a **small area around each target**

➡️ Turns chain damage into AoE spread

---

🧠 **How to Use Effectively**

✔️ Best for:
• 🧟 Summon-heavy enemy matchups  
• 🔁 Duplicate hero builds  
• ⚡ Multi-target damage setups  

---

💡 **Strategy Tips**

• Works best when enemies have **same hero types**  
• Combine with **AoE or chain perks**  
• Strong against swarm-style enemies  

---

⚠️ **Weakness**

• ❌ Weak vs diverse enemy teams  
• ❌ Less effective vs single-target builds  
• ❌ Requires correct matchup to shine  

---

🛡️ **Best Synergy**

• 🌀 Force Field (AoE + spread damage)  
• 🧿 Antimagic Field (control + DoT)  
• 💧 Manaflow (scaling over time)  

---

🎯 **Playstyle**

➡️ Anti-swarm / anti-duplicate  
➡️ Spread damage across enemies

📌 **Resonance – Quick Summary**

• 🔷 Chain damage to identical enemies  
• 💥 Hits up to 4 additional targets  
• 📈 Damage increases per target  

🔥 Lv 60 → stronger chain scaling  
💣 Lv 100 → AoE around targets  

🧠 Best for:
• 🧟 Summon builds  
• 🔁 Duplicate enemies  

⚠️ Weak vs:
• Mixed teams  
• Single-target fights  

🎯 Key:
→ Use vs same-type enemy spam`,
    imagePath: null
  }
    
    ];
    // ==================== ARTFUL DODGER GUIDE ====================
const artfulDodgerMessages = [
  {
    content: `🕶️ **Artful Dodger – Star Perk Guide**

Artful Dodger is a **defensive + counterattack perk** that allows your hero to dodge attacks and strike back with strong damage.

---

⚙️ **Core Mechanic**

• 🎲 ~40% chance to **dodge standard attacks**  
• ⚡ On successful dodge → **counterattack triggered**  

💥 Counterattack deals:
→ ~337%+ of your hero’s damage  

---

🔥 **Key Advantage**

• Avoids incoming damage  
• Converts defense into **offense**  
• Very strong in **sustained fights**

---

📈 **Perk Levels & Effects**

🔸 **Lv 20**
• ⚠️ Counterattacks apply **Weakness debuff (6s)**  
→ Enemies take **+30% damage**

---

🔸 **Lv 40**
• 📉 Battle Prowess requirement reduced to 15  

---

🔸 **Lv 60**
• 🎲 Dodge chance increased to **60%**

➡️ Major power spike

---

🔸 **Lv 80**
• 📉 Battle Prowess requirement reduced to 10  

---

🔸 **Lv 100 (IMPORTANT)**
• ⚡ Dodging restores **300 energy (1s cooldown)**  

➡️ Turns dodging into energy generation

---

🧠 **How to Use Effectively**

✔️ Best for:
• ⚔️ Duel / single-target fights  
• 🛡️ Sustain-based heroes  
• ⚡ Energy-reliant builds  

---

💡 **Strategy Tips**

• Higher dodge = higher damage output  
• Combine with **healing or sustain perks**  
• Works best in **long fights**  

---

⚠️ **Weakness**

• ❌ RNG-based (depends on luck)  
• ❌ Weak vs AoE / unavoidable damage  
• ❌ Less effective in fast burst fights  

---

🛡️ **Best Synergy**

• ❤️ Healing perks (Verena, Aqua)  
• 💧 Manaflow (scaling over time)  
• 🛡️ Defensive builds  

---

🎯 **Playstyle**

➡️ Defensive → counterattack  
➡️ Win through sustain + retaliation

📌 **Artful Dodger – Quick Summary**

• 🎲 Chance to dodge attacks  
• ⚡ Dodge → strong counterattack  
• 💥 Scales with hero damage  

🔥 Lv 20 → Weakness debuff  
🎲 Lv 60 → 60% dodge chance  
⚡ Lv 100 → Energy gain on dodge  

🧠 Best for:
• 🛡️ Sustain builds  
• ⚔️ Duel fights  

⚠️ Weak vs:
• AoE damage  
• Burst fights  

🎯 Key:
→ Survive and counterattack`,
    imagePath: null
  }
];

// ==================== SNOWSTORM GUIDE ====================
const snowstormMessages = [
  {
    content: `❄️ **Snowstorm – Star Perk Guide**

Snowstorm is a **control + AoE utility perk** that creates a Blizzard to damage and stun enemies.

---

⚙️ **Core Mechanic**

Once every **15 seconds**:

➡️ Creates a ❄️ **Blizzard** around the target  
➡️ Duration: ~5 seconds (scales slightly)

💥 Enemies inside:
• Take damage  
• 🎲 Have a **25% chance to be stunned (1s)**  

---

🔥 **Key Advantage**

• Strong crowd control (stuns)  
• Affects multiple enemies (AoE)  
• Disrupts enemy attacks and abilities  

---

📈 **Perk Levels & Effects**

🔸 **Lv 20**
• 🎲 Stun chance increased to **50%**

---

🔸 **Lv 40**
• 📉 Battle Prowess requirement reduced to 15  

---

🔸 **Lv 60**
• ⏱️ Trigger cooldown reduced to **10s**

➡️ More frequent Blizzard

---

🔸 **Lv 80**
• 📉 Battle Prowess requirement reduced to 10  

---

🔸 **Lv 100 (IMPORTANT)**
• ⚠️ Blizzard applies **Weakness**
→ Enemies take **+100% damage**

➡️ Massive damage amplification

---

🧠 **How to Use Effectively**

✔️ Best for:
• 🧟 Multi-target fights  
• ⏳ Long fights (more triggers)  
• ⚡ Control-heavy builds  

---

💡 **Strategy Tips**

• Position to hit multiple enemies  
• Combine with **high damage perks**  
• Use with **AoE heroes** for maximum value  

---

⚠️ **Weakness**

• ❌ RNG-based stun chance  
• ❌ Cooldown dependent  
• ❌ Less effective in fast burst fights  

---

🛡️ **Best Synergy**

• 🔷 Resonance (multi-target damage)  
• 🌀 Force Field (AoE + sustain)  
• 💧 Manaflow (scaling fights)  

---

🎯 **Playstyle**

➡️ Crowd control + disruption  
➡️ Win by disabling enemies over time

📌 **Snowstorm – Quick Summary**

• ❄️ Creates Blizzard every 15s  
• 🎲 Stuns enemies (AoE)  
• 💥 Deals continuous damage  

🔥 Lv 20 → 50% stun chance  
⏱️ Lv 60 → Faster triggers  
⚠️ Lv 100 → +100% damage (Weakness)  

🧠 Best for:
• 🧟 Multi-target fights  
• ⚡ Control builds  

⚠️ Weak vs:
• Fast burst fights  

🎯 Key:
→ Control enemies and amplify damage`,
    imagePath: null
  }
];

// ==================== WRATH OF HEAVENS GUIDE ====================
const wrathOfHeavensMessages = [
  {
    content: `🔥 **Wrath of Heavens – Star Perk Guide**

Wrath of Heavens is a **targeted damage + pressure perk** that focuses on the strongest enemy in a column.

---

⚙️ **Core Mechanic**

At the start of each round:

➡️ A 🔥 **pillar of fire** appears  
➡️ Targets enemy hero with **highest Battle Prowess in that column**

💥 Deals:
• Continuous damage per second  
• Small AoE around the target  

📌 The pillar stays active until:
→ The target dies for the first time

---

🔥 **Key Advantage**

• Focuses strongest enemy (high priority target)  
• Continuous pressure over time  
• Great for weakening key units early  

---

📈 **Perk Levels & Effects**

🔸 **Lv 20**
• 🔄 Pillar **slowly follows target**

➡️ Huge upgrade (prevents easy escape)

---

🔸 **Lv 40**
• 📉 Battle Prowess requirement reduced to 15  

---

🔸 **Lv 60**
• 💥 Increased **AoE size**

---

🔸 **Lv 80**
• 📉 Battle Prowess requirement reduced to 10  

---

🔸 **Lv 100 (IMPORTANT)**
• ⚡ Drains **30% energy per second**

➡️ Extremely strong vs ability-based heroes

---

🧠 **How to Use Effectively**

✔️ Best for:
• 🎯 Targeting strong enemy carries  
• ⚡ Energy disruption builds  
• ⏳ Long fights  

---

💡 **Strategy Tips**

• Place strong enemy in column → punish them  
• Combine with **energy denial perks**  
• Use with **damage-over-time builds**  

---

⚠️ **Weakness**

• ❌ Limited to one target per column  
• ❌ Less effective vs weak enemies  
• ❌ Can be avoided without Lv20 follow  

---

🛡️ **Best Synergy**

• 🧿 Antimagic Field (energy control)  
• 🔮 Tech Orb (HP pressure)  
• 💧 Manaflow (scaling fights)  

---

🎯 **Playstyle**

➡️ Targeted pressure  
➡️ Anti-carry / anti-strong units

📌 **Wrath of Heavens – Quick Summary**

• 🔥 Pillar targets strongest enemy in column  
• 💥 Deals continuous damage  
• ⏳ Stays until target dies  

🔄 Lv 20 → Follows target  
💥 Lv 60 → Bigger AoE  
⚡ Lv 100 → Energy drain  

🧠 Best for:
• 🎯 Targeting strong heroes  
• ⚡ Energy control  

⚠️ Weak vs:
• Weak enemy targets  
• Mobility (before Lv20)  

🎯 Key:
→ Pressure enemy carry constantly`,
    imagePath: null
  }
];

// ==================== AEGIS GUIDE ====================
const aegisMessages = [
  {
    content: `🛡️ **Aegis – Star Perk Guide**

Aegis is a **defensive + survivability perk** that provides strong shielding and life-saving effects.

---

⚙️ **Core Mechanic**

At the start of each round:

➡️ Hero gains a 🛡️ **Shield equal to ~120% of max HP**

💥 The shield:
• Absorbs incoming damage  
• Refreshes every round  

---

🔥 **Key Advantage**

• Strong protection vs burst damage  
• Increases survivability significantly  
• Reliable and consistent defense  

---

📈 **Perk Levels & Effects**

🔸 **Lv 20**
• 💀 Once per round:
→ Survive a lethal hit  
→ Gain a new Aegis Shield  

➡️ Acts like a “second life”

---

🔸 **Lv 40**
• 📉 Battle Prowess requirement reduced to 15  

---

🔸 **Lv 60**
• 💥 While shielded:
→ Taking damage deals **50% of your damage to nearby enemies**  

➡️ Turns defense into offense  

---

🔸 **Lv 80**
• 📉 Battle Prowess requirement reduced to 10  

---

🔸 **Lv 100 (IMPORTANT)**
• 👥 Allies in the same column also gain the shield  

➡️ Massive team-wide survivability boost  

---

🧠 **How to Use Effectively**

✔️ Best for:
• 🛡️ Tank builds  
• 🧟 Frontline heroes  
• ⏳ Long fights  

---

💡 **Strategy Tips**

• Combine with **healing perks**  
• Stack HP → stronger shields  
• Keep formation → protect allies (Lv100)  

---

⚠️ **Weakness**

• ❌ Shield can be broken by heavy burst  
• ❌ Less impact in very fast fights  
• ❌ Needs sustain to shine fully  

---

🛡️ **Best Synergy**

• ❤️ Healing perks (Verena, Aqua)  
• 💧 Manaflow (scaling fights)  
• 🌀 Force Field (tank synergy)  

---

🎯 **Playstyle**

➡️ Defensive / sustain  
➡️ Win by surviving longer than enemy

📌 **Aegis – Quick Summary**

• 🛡️ Shield every round (~120% HP)  
• 💀 Lv 20 → Survive lethal hit  
• 💥 Lv 60 → Damage enemies when hit  
• 👥 Lv 100 → Shield allies in column  

🧠 Best for:
• 🛡️ Tank builds  
• ⏳ Long fights  

⚠️ Weak vs:
• Burst damage  

🎯 Key:
→ Stack HP and survive longer`,
    imagePath: null
  }

  // No content images
];



// ==================== SOUL GEM GUIDE ====================
const soulGemMessages = [
  {
    content: `💀 **Soul Gem – Star Perk Guide**

Soul Gem is a **revive + scaling perk** that allows your hero to come back to life after collecting enough souls.

---

⚙️ **Core Mechanic**

• 💎 Each time ANY unit dies (enemy or ally):
→ A **Soul Gem** is filled  

➡️ Once **8 Soul Gems** are filled:

💀 Hero is revived with:
→ ❤️ ~60% HP  

---

🔥 **Key Advantage**

• Gives a **second life**  
• Benefits from ALL deaths (not just enemies)  
• Strong in chaotic / long fights  

---

📈 **Perk Levels & Effects**

🔸 **Lv 20**
• ⚡ When above threshold:
→ +30% attack & movement speed  

➡️ Turns revive into power spike  

---

🔸 **Lv 40**
• 📉 Battle Prowess requirement reduced to 15  

---

🔸 **Lv 60**
• 💎 Required Soul Gems reduced to **5**  

➡️ Much faster revive  

---

🔸 **Lv 80**
• 📉 Battle Prowess requirement reduced to 10  

---

🔸 **Lv 100 (IMPORTANT)**
• ⏱️ Every 2 seconds:
→ Automatically fills **1 Soul Gem**  

➡️ Passive revive progress (VERY strong)

---

🧠 **How to Use Effectively**

✔️ Best for:
• 🧟 Long fights  
• ⚔️ High-death environments  
• 🔄 Sustain / revive builds  

---

💡 **Strategy Tips**

• Works best when many units are dying  
• Combine with **summon builds** (more deaths = faster stacks)  
• Use with **defensive perks** to survive after revive  

---

⚠️ **Weakness**

• ❌ Needs time to activate  
• ❌ Weak in fast burst fights  
• ❌ Can revive into dangerous situations  

---

🛡️ **Best Synergy**

• 🧟 Summoners (Muerta, Bunny)  
• 🛡️ Aegis (extra survivability)  
• 💧 Manaflow (long fights)  

---

🎯 **Playstyle**

➡️ Revive / sustain  
➡️ Win by outlasting opponent

📌 **Soul Gem – Quick Summary**

• 💎 Gains stacks from deaths  
• 💀 Revives at 8 stacks (~60% HP)  
• 🔄 Lv 60 → Only 5 stacks needed  

⚡ Lv 20 → Attack + speed boost  
⏱️ Lv 100 → Auto stack generation  

🧠 Best for:
• 🧟 Long fights  
• 🔄 Sustain builds  

⚠️ Weak vs:
• Burst fights  

🎯 Key:
→ More deaths = faster revive`,
    imagePath: null
  }
];




// ==================== EXPORT ====================
module.exports = {
  replica: {
    name: 'Replica Guide',
    threadName: '📘 Replica Guide | How it works & counter strategies',
    thumbnailPath: 'public/images/replica_thumbnail.png',
    messages: replicaMessages
  },
  thunderveil: {
    name: 'Thunderveil Guide',
    threadName: '⚡ Thunderveil Guide | Damage boost & mechanics',
    thumbnailPath: 'public/images/thunderveil_thumbnail.png',
    messages: thunderveilMessages
  },
  techorb: {
    name: 'Tech Orb Guide',
    threadName: '🔮 Tech Orb Guide | Max HP reduction & HP steal',
    thumbnailPath: 'public/images/techorb_thumbnail.png',
    messages: techOrbMessages
  },
  manaflow: {
    name: 'Manaflow Guide',
    threadName: '💧 Manaflow Guide | Round‑by‑round ability scaling',
    thumbnailPath: 'public/images/manaflow_thumbnail.png',
    messages: manaflowMessages
  },
  atmosphericshield: {
    name: 'Atmospheric Shield Guide',
    threadName: '🛡️ Atmospheric Shield Guide | Strong round‑start shield',
    thumbnailPath: 'public/images/atmospheric_shield_thumbnail.png',
    messages: atmosphericShieldMessages
  },
  antimagicfield: {
    name: 'Antimagic Field Guide',
    threadName: '🧿 Antimagic Field Guide | Energy control & anti‑summon',
    thumbnailPath: 'public/images/antimagic_field_thumbnail.png',
    messages: antimagicFieldMessages
  },
  forcefield: {
    name: 'Force Field Guide',
    threadName: '🌀 Force Field Guide | Passive HP‑based damage',
    thumbnailPath: 'public/images/force_field_thumbnail.png',
    messages: forceFieldMessages
  },

    resonance: {
    name: 'Resonance Guide',
    threadName: '🔷 Resonance Guide | Chain damage to identical enemies',
    thumbnailPath: 'public/images/resonance_thumbnail.png',
    messages: resonanceMessages
  },
    
    
    artfuldodger: {
    name: 'Artful Dodger Guide',
    threadName: '🕶️ Artful Dodger Guide | Dodge & counterattack',
    thumbnailPath: 'public/images/artful_dodger_thumbnail.png',
    messages: artfulDodgerMessages
  },
  snowstorm: {
    name: 'Snowstorm Guide',
    threadName: '❄️ Snowstorm Guide | Blizzard control & AoE stun',
    thumbnailPath: 'public/images/snowstorm_thumbnail.png',
    messages: snowstormMessages
  },
      
      wrathofheavens: {
    name: 'Wrath of Heavens Guide',
    threadName: '🔥 Wrath of Heavens Guide | Targeted pillar of fire',
    thumbnailPath: 'public/images/wrath_of_heavens_thumbnail.png',
    messages: wrathOfHeavensMessages
  },
  aegis: {
    name: 'Aegis Guide',
    threadName: '🛡️ Aegis Guide | Strong round shield & second life',
    thumbnailPath: 'public/images/aegis_thumbnail.png',
    messages: aegisMessages
  },
    
    soulgem: {
    name: 'Soul Gem Guide',
    threadName: '💀 Soul Gem Guide | Revive & scaling perk',
    thumbnailPath: 'public/images/soul_gem_thumbnail.png',
    messages: soulGemMessages
}


};