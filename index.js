const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const http = require('http');
const https = require('https'); // Dodane

// Serwer HTTP dla Render.com
http.createServer((req, res) => {
    res.write('Bot jest aktywny!');
    res.end();
}).listen(process.env.PORT || 3000);

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// --- FUNKCJE DO KOMUNIKACJI Z ARKUSZEM ---
async function wyslijDoArkusza(dane) {
    const url = new URL(config.googleScriptUrl);
    const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    };
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
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch(e) { resolve([]); }
            });
        });
    });
}

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] 
});

const commands = [
    { name: 'plus', description: 'Dodaje plusa', options: [{ name: 'uzytkownik', type: 6, description: 'Użytkownik', required: true }, { name: 'ilosc', type: 4, description: 'Ilość', required: true }, { name: 'powod', type: 3, description: 'Powód', required: true }] },
    { name: 'minus', description: 'Dodaje minusa', options: [{ name: 'uzytkownik', type: 6, description: 'Użytkownik', required: true }, { name: 'ilosc', type: 4, description: 'Ilość', required: true }, { name: 'powod', type: 3, description: 'Powód', required: true }] },
    { name: 'nagana', description: 'Daje naganę', options: [{ name: 'uzytkownik', type: 6, description: 'Użytkownik', required: true }, { name: 'powod', type: 3, description: 'Powód', required: true }] },
    { name: 'urlop', description: 'Nadaje urlop', options: [{ name: 'uzytkownik', type: 6, description: 'Użytkownik', required: true }, { name: 'data', type: 3, description: 'Do kiedy', required: true }, { name: 'powod', type: 3, description: 'Powód', required: true }] },
    { name: 'koniecurlop', description: 'Kończy urlop', options: [{ name: 'uzytkownik', type: 6, description: 'Użytkownik', required: true }] },
    { name: 'zatrudnij', description: 'Zatrudnia pracownika', options: [{ name: 'uzytkownik', type: 6, description: 'Użytkownik', required: true }] },
    { name: 'zwolnij', description: 'Zwalnia pracownika', options: [{ name: 'uzytkownik', type: 6, description: 'Użytkownik', required: true }] },
    { name: 'listajob', description: 'Pokazuje listę pracowników' }
];

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`Bot działa jako ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    const isManager = interaction.member.roles.cache.has(config.managerRoleId);
    const dataLogu = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });

    // Walidacja uprawnień dla wszystkich komend kadrowych
    if (['plus', 'minus', 'nagana', 'urlop', 'koniecurlop', 'zatrudnij', 'zwolnij', 'listajob'].includes(commandName) && !isManager) {
        return interaction.reply({ content: 'Brak uprawnień (wymagany Manager)!', ephemeral: true });
    }

    // --- LOGIKA ISTNIEJĄCA (Plus, Minus, Nagana, Urlop) ---
    if (['plus', 'minus', 'nagana'].includes(commandName)) {
        // ... (Twój kod pozostaje bez zmian) ...
        const target = interaction.options.getUser('uzytkownik');
        const amount = interaction.options.getInteger('ilosc');
        const reason = interaction.options.getString('powod');
        const channel = interaction.guild.channels.cache.get(config.logChannelId);
        const embed = new EmbedBuilder()
            .setTitle(commandName === 'plus' ? '➕ Dodano plusa' : commandName === 'minus' ? '➖ Dodano minusa' : '⚠️ Nagana')
            .setColor(commandName === 'plus' ? 0x00FF00 : 0xFF0000)
            .addFields({ name: 'Pracownik', value: `${target}`, inline: false }, { name: 'Powód', value: reason, inline: false });
        if (commandName !== 'nagana') embed.addFields({ name: 'Ilość', value: `${amount}`, inline: false });
        embed.addFields({ name: 'Podpis', value: `${interaction.user}`, inline: true }, { name: 'Data', value: dataLogu, inline: true });
        await channel.send({ embeds: [embed] });
        await interaction.reply({ content: 'Wysłano log.', ephemeral: true });
    }

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

    // --- NOWA LOGIKA (Zatrudnij, Zwolnij, Lista) ---
    if (commandName === 'zatrudnij') {
        const target = interaction.options.getMember('uzytkownik');
        await wyslijDoArkusza({ action: 'zatrudnij', id: target.id, username: target.user.username });
        await target.roles.add([config.rolePracownikID, config.roleDrugiID]); // Dodaj obie role
        await interaction.reply(`✅ Zatrudniono ${target.user.username}.`);
    }

    if (commandName === 'zwolnij') {
        const target = interaction.options.getMember('uzytkownik');
        await wyslijDoArkusza({ action: 'zwolnij', id: target.id });
        await target.roles.remove([config.rolePracownikID, config.roleDrugiID]); // Usuń obie role
        await interaction.reply(`❌ Zwolniono ${target.user.username}.`);
    }

    if (commandName === 'listajob') {
        const listaRaw = await pobierzListe();
        const lista = listaRaw.length > 0 
            ? listaRaw.map(p => `• **${p[1]}** | Od: ${p[2]}`).join('\n') 
            : 'Brak pracowników w bazie.';
        await interaction.reply(`**Aktualna lista pracowników:**\n${lista}`);
    }
});

client.login(process.env.TOKEN);
