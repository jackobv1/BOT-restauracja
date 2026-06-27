const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] 
});

client.once('ready', () => { console.log(`Bot działa jako ${client.user.tag}!`); });

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.member.roles.cache.has(config.managerRoleId)) return interaction.reply({ content: 'Brak uprawnień!', ephemeral: true });

    const { commandName } = interaction;

    if (['plus', 'minus', 'nagana'].includes(commandName)) {
        const target = interaction.options.getUser('uzytkownik');
        const amount = interaction.options.getInteger('ilosc');
        const reason = interaction.options.getString('powod');
        const channel = interaction.guild.channels.cache.get(config.logChannelId);

        const embed = new EmbedBuilder()
            .setTitle(commandName === 'plus' ? '➕ Dodano plusa' : commandName === 'minus' ? '➖ Dodano minusa' : '⚠️ Nagana')
            .setColor(commandName === 'plus' ? 0x00FF00 : 0xFF0000)
            .addFields({ name: 'Pracownik', value: `${target}`, inline: true }, { name: 'Powód', value: reason });
        
        if (commandName !== 'nagana') embed.addFields({ name: 'Ilość', value: `${amount}`, inline: true });
        
        await channel.send({ embeds: [embed] });
        await interaction.reply({ content: 'Wysłano log.', ephemeral: true });
    }

    if (commandName === 'urlop') {
        const target = interaction.options.getMember('uzytkownik');
        await target.roles.add(config.roleUrlopID);
        await interaction.guild.channels.cache.get(config.hrChannelId).send(`🏖️ **URLOP:** ${target} do ${interaction.options.getString('data')}. Powód: ${interaction.options.getString('powod')}`);
        await interaction.reply({ content: 'Nadano urlop.', ephemeral: true });
    }

    if (commandName === 'koniecurlop') {
        const target = interaction.options.getMember('uzytkownik');
        await target.roles.remove(config.roleUrlopID);
        await interaction.reply({ content: 'Zakończono urlop.', ephemeral: true });
    }
});

client.login(process.env.TOKEN);
