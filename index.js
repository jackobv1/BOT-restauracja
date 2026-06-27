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
        console.log('Komendy zostały pomyślnie zarejestrawane!');
    } catch (e) { console.error(e); }
    console.log(`Bot działa jako ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    const isManager = interaction.member.roles.cache.has(config.managerRoleId);
    const isUrlopAdmin = interaction.member.roles.cache.has(config.urlopRoleId);
    const dataLogu = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });

    // Walidacja uprawnień
    if (['plus', 'minus', 'nagana'].includes(commandName) && !isManager) return interaction.reply({ content: 'Brak uprawnień (wymagany Manager)!', ephemeral: true });
    if (['urlop', 'koniecurlop'].includes(commandName) && !isManager && !isUrlopAdmin) return interaction.reply({ content: 'Brak uprawnień!', ephemeral: true });

    // Logi dla Plus / Minus / Nagana
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

        if (commandName !== 'nagana') embed.addFields({ name: 'Ilość', value: `${amount}`, inline: false });
        
        embed.addFields(
            { name: 'Podpis', value: `${interaction.user}`, inline: true },
            { name: 'Data', value: dataLogu, inline: true }
        );
        
        await channel.send({ embeds: [embed] });
        await interaction.reply({ content: 'Wysłano log do administracji.', ephemeral: true });
    }

    // Logi dla Urlopu
    if (commandName === 'urlop') {
        const target = interaction.options.getMember('uzytkownik');
        await target.roles.add(config.roleUrlopID);
        
        const embed = new EmbedBuilder()
            .setTitle('🏖️ Nadano urlop')
            .setColor(0x0099FF)
            .addFields(
                { name: 'Pracownik', value: `${target}`, inline: false },
                { name: 'Do kiedy', value: interaction.options.getString('data'), inline: false },
                { name: 'Powód', value: interaction.options.getString('powod'), inline: false },
                { name: 'Podpis', value: `${interaction.user}`, inline: true },
                { name: 'Data', value: dataLogu, inline: true }
            );
            
        await interaction.guild.channels.cache.get(config.hrChannelId).send({ embeds: [embed] });
        await interaction.reply({ content: 'Nadano urlop.', ephemeral: true });
    }

    // Koniec urlopu
    if (commandName === 'koniecurlop') {
        const target = interaction.options.getMember('uzytkownik');
        await target.roles.remove(config.roleUrlopID);
        await interaction.reply({ content: 'Zakończono urlop.', ephemeral: true });
    }
});

client.login(process.env.TOKEN);
