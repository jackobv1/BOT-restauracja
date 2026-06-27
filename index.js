const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const http = require('http');

// Serwer HTTP dla Render.com
http.createServer((req, res) => {
    res.write('Bot jest aktywny!');
    res.end();
}).listen(process.env.PORT || 3000);

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] 
});

const commands = [
    { name: 'plus', description: 'Dodaje plusa', options: [{ name: 'uzytkownik', type: 6, description: 'Użytkownik', required: true }, { name: 'ilosc', type: 4, description: 'Ilość', required: true }, { name: 'powod', type: 3, description: 'Powód', required: true }] },
    { name: 'minus', description: 'Dodaje minusa', options: [{ name: 'uzytkownik', type: 6, description: 'Użytkownik', required: true }, { name: 'ilosc', type: 4, description: 'Ilość', required: true }, { name: 'powod', type: 3, description: 'Powód', required: true }] },
    { name: 'nagana', description: 'Daje naganę', options: [{ name: 'uzytkownik', type: 6, description: 'Użytkownik', required: true }, { name: 'powod', type: 3, description: 'Powód', required: true }] },
    { name: 'urlop', description: 'Nadaje urlop', options: [{ name: 'uzytkownik', type: 6, description: 'Użytkownik', required: true }, { name: 'data', type: 3, description: 'Do kiedy', required: true }, { name: 'powod', type: 3, description: 'Powód', required: true }] },
    { name: 'koniecurlop', description: 'Kończy urlop', options: [{ name: 'uzytkownik', type: 6, description: 'Użytkownik', required: true }] }
];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Komendy zostały pomyślnie zarejestrowane!');
    } catch (e) { console.error(e); }
    console.log(`Bot działa jako ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    const isManager = interaction.member.roles.cache.has(config.managerRoleId);
    const isUrlopAdmin = interaction.member.roles.cache.has(config.urlopRoleId);

    // 1. Uprawnienia dla Plus/Minus/Nagana (TYLKO MANAGER)
    if (['plus', 'minus', 'nagana'].includes(commandName)) {
        if (!isManager) return interaction.reply({ content: 'Brak uprawnień (wymagany Manager)!', ephemeral: true });
    }

    // 2. Uprawnienia dla Urlop/Koniecurlop (MANAGER LUB ROLA URLOPOWA)
    if (['urlop', 'koniecurlop'].includes(commandName)) {
        if (!isManager && !isUrlopAdmin) return interaction.reply({ content: 'Brak uprawnień!', ephemeral: true });
    }

    if (['plus', 'minus', 'nagana'].includes(commandName)) {
        const target = interaction.options.getUser('uzytkownik');
        const amount = interaction.options.getInteger('ilosc');
        const reason = interaction.options.getString('powod');
        const channel = interaction.guild.channels.cache.get(config.logChannelId);
        
        const embed = new EmbedBuilder()
            .setTitle(commandName === 'plus' ? '➕ Dodano plusa' : commandName === 'minus' ? '➖ Dodano minusa' : '⚠️ Nagana')
            .setColor(commandName === 'plus' ? 0x00FF00 : 0xFF0000)
            .addFields(
                { name: 'Pracownik', value: `${target}`, inline: false },
                { name: 'Powód', value: reason, inline: false }
            );

        if (commandName !== 'nagana') {
            embed.addFields({ name: 'Ilość', value: `${amount}`, inline: false });
        }

        embed.addFields({ name: 'Podpis', value: `${interaction.user}`, inline: false });
        
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
