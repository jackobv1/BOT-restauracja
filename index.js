const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const http = require('http');
const https = require('https');

// Serwer HTTP dla Render.com
http.createServer((req, res) => { res.write('Bot jest aktywny!'); res.end(); }).listen(process.env.PORT || 3000);

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// Funkcje do komunikacji z Arkuszem
async function wyslijDoArkusza(dane) {
    const url = new URL(config.googleScriptUrl);
    const options = { hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json' } };
    return new Promise((resolve) => {
        const req = https.request(options, (res) => resolve(true));
        req.write(JSON.stringify(dane));
        req.end();
    });
}

async function pobierzListe() {
    return new Promise((resolve) => {
        https.get(config.googleScriptUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve([]); } });
        });
    });
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

const commands = [
    { name: 'plus', description: 'Dodaje plusa', options: [{ name: 'uzytkownik', type: 6, required: true }, { name: 'ilosc', type: 4, required: true }, { name: 'powod', type: 3, required: true }] },
    { name: 'minus', description: 'Dodaje minusa', options: [{ name: 'uzytkownik', type: 6, required: true }, { name: 'ilosc', type: 4, required: true }, { name: 'powod', type: 3, required: true }] },
    { name: 'nagana', description: 'Daje naganę', options: [{ name: 'uzytkownik', type: 6, required: true }, { name: 'powod', type: 3, required: true }] },
    { name: 'urlop', description: 'Nadaje urlop', options: [{ name: 'uzytkownik', type: 6, required: true }, { name: 'data', type: 3, required: true }, { name: 'powod', type: 3, required: true }] },
    { name: 'koniecurlop', description: 'Kończy urlop', options: [{ name: 'uzytkownik', type: 6, required: true }] },
    { name: 'zatrudnij', description: 'Zatrudnia pracownika', options: [{ name: 'uzytkownik', type: 6, required: true }] },
    { name: 'zwolnij', description: 'Zwalnia pracownika', options: [{ name: 'uzytkownik', type: 6, required: true }] },
    { name: 'listajob', description: 'Lista pracowników' }
];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`Bot gotowy: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    const isManager = interaction.member.roles.cache.has(config.managerRoleId);
    const dataLogu = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });

    // Walidacja uprawnień
    if (['plus', 'minus', 'nagana', 'urlop', 'koniecurlop', 'zatrudnij', 'zwolnij', 'listajob'].includes(commandName) && !isManager) 
        return interaction.reply({ content: 'Brak uprawnień (wymagany Manager)!', ephemeral: true });

    // Komendy HR
    if (commandName === 'zatrudnij') {
        const target = interaction.options.getMember('uzytkownik');
        // Nadaje rolę Burger Shot + ostatnią z listy (Stażysta)
        const stazystaRoleId = config.pracownikRoles[config.pracownikRoles.length - 1];
        await target.roles.add([config.burgerShotRoleId, stazystaRoleId]);
        await wyslijDoArkusza({ action: 'zatrudnij', id: target.id, username: target.user.username });
        await interaction.reply(`✅ Zatrudniono ${target.user.username} na stanowisko Stażysty.`);
    }

    if (commandName === 'zwolnij') {
        const target = interaction.options.getMember('uzytkownik');
        // Usuwa wszystkie możliwe role pracownicze + Burger Shot
        await target.roles.remove([config.burgerShotRoleId, ...config.pracownikRoles]).catch(console.error);
        await wyslijDoArkusza({ action: 'zwolnij', id: target.id });
        await interaction.reply(`❌ Zwolniono ${target.user.username} i usunięto wszystkie rangi.`);
    }

    if (commandName === 'listajob') {
        const list = await pobierzListe();
        await interaction.reply(list.length ? `**Lista pracowników:**\n${list.map(p => `• **${p[1]}** (od: ${p[2]})`).join('\n')}` : 'Brak pracowników w bazie.');
    }

    // Logika Plus/Minus/Nagana (Twoja oryginalna)
    if (['plus', 'minus', 'nagana'].includes(commandName)) {
        const target = interaction.options.getUser('uzytkownik');
        const channel = interaction.guild.channels.cache.get(config.logChannelId);
        const embed = new EmbedBuilder()
            .setTitle(commandName === 'plus' ? '➕ Dodano plusa' : commandName === 'minus' ? '➖ Dodano minusa' : '⚠️ Nagana')
            .setColor(commandName === 'plus' ? 0x00FF00 : 0xFF0000)
            .addFields(
                { name: 'Pracownik', value: `${target}`, inline: false },
                { name: 'Powód', value: interaction.options.getString('powod'), inline: false }
            );
        if (commandName !== 'nagana') embed.addFields({ name: 'Ilość', value: `${interaction.options.getInteger('ilosc')}`, inline: false });
        embed.addFields({ name: 'Podpis', value: `${interaction.user}`, inline: true }, { name: 'Data', value: dataLogu, inline: true });
        await channel.send({ embeds: [embed] });
        await interaction.reply({ content: 'Wysłano log.', ephemeral: true });
    }

    // Logika Urlopu
    if (commandName === 'urlop') {
        const target = interaction.options.getMember('uzytkownik');
        await target.roles.add(config.roleUrlopID);
        await interaction.reply({ content: 'Nadano urlop.', ephemeral: true });
    }

    if (commandName === 'koniecurlop') {
        const target = interaction.options.getMember('uzytkownik');
        await target.roles.remove(config.roleUrlopID);
        await interaction.reply({ content: 'Zakończono urlop.', ephemeral: true });
    }
});

client.login(process.env.TOKEN);
