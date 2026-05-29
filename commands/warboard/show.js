const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const db = require('../../database');
const WarboardManager = require('../../systems/warboard/warboardManager');
const { BASES } = require('../../config');
const { parseDate, formatDateDisplay } = require('../../utils/dateUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warboard_show')
    .setDescription('Preview the warboard with per‑base status')
    .addStringOption(opt => 
      opt.setName('date')
        .setDescription('War date')
        .setRequired(true)
        .setAutocomplete(true)
    ),
  
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;
    const dates = db.getWarboardDates(guildId);
    
    const choices = dates.map(stored => ({
      name: formatDateDisplay(stored),
      value: stored
    }));
    
    const filtered = choices.filter(choice =>
      choice.name.toLowerCase().includes(focusedValue.toLowerCase())
    ).slice(0, 25);
    
    await interaction.respond(filtered);
  },
  
  async execute(interaction) {
    const dateInput = interaction.options.getString('date');
    const guildId = interaction.guildId;
    
    const parsedDate = parseDate(dateInput);
    if (!parsedDate) {
      return interaction.reply({ content: '<a:Red_cross_mark:1479397724603416606> Invalid date format.', flags: MessageFlags.Ephemeral });
    }
    
    const assignments = db.getAssignments(guildId, parsedDate);
    if (assignments.length === 0) {
      return interaction.reply({ content: '<a:mail_box:1479425779530989670> No assignments for this date.', flags: MessageFlags.Ephemeral });
    }
    
    const displayDate = formatDateDisplay(parsedDate);
    const baseCounts = db.getBaseCounts(guildId, parsedDate);
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`<a:Folder:1479426127037468702> Warboard Preview – ${displayDate}`)
      .setDescription('Current assignments per base:')
      .setTimestamp();
    
    BASES.forEach(base => {
      const count = baseCounts.get(base.name) || 0;
      const status = count >= base.capacity ? '<a:Green_tick_mark:1479393702031134730> Full' : '<a:Red_info:1479392711055245405> Open';
      embed.addFields({
        name: `${base.name} (${count}/${base.capacity})`,
        value: status,
        inline: true
      });
    });
    
    const totalPlayers = assignments.length;
    embed.setFooter({ text: `Total: ${totalPlayers} players` });
    
    const warboardText = WarboardManager.buildWarboardMessage(guildId, parsedDate, assignments);
    
    if (warboardText.length > 1024) {
      await interaction.reply({
        embeds: [embed],
        files: [{ attachment: Buffer.from(warboardText), name: `warboard-${parsedDate}.txt` }],
        flags: MessageFlags.Ephemeral
      });
    } else {
      await interaction.reply({
        content: warboardText,
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      });
    }
  }
};