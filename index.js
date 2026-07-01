const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const http = require('http');
const https = require('https');

http.createServer((req, res) => { res.write('Bot aktywny!'); res.end(); }).listen(process.env.PORT || 3000);

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// --- FUNKCJE POMOCNICZE ---
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
    { name: 'plus', description: 'Dodaje plusa', options: [{ name: 'uzytkownik', type: 6, description: 'Wybierz użytkownika', required: true }, { name: 'ilosc', type: 4, description: 'Ilość', required: true }, { name: 'powod', type: 3, description: 'Powód', required: true }] },
    { name: 'minus', description: 'Dodaje minusa', options: [{ name: 'uzytkownik', type: 6, description: 'Wybierz użytkownika', required: true }, { name: 'ilosc', type: 4, description: 'Ilość', required: true }, { name: 'powod', type: 3, description: 'Powód', required: true }] },
    { name: 'nagana', description: 'Daje naganę', options: [{ name: 'uzytkownik', type: 6, description: 'Wybierz użytkownika', required: true }, { name: 'powod', type: 3, description: 'Powód', required: true }] },
    { name: 'urlop', description: 'Nadaje urlop', options: [{ name: 'uzytkownik', type: 6, description: 'Wybierz użytkownika', required: true }, { name: 'data', type: 3, description: 'Do kiedy', required: true }, { name: 'powod', type: 3, description: 'Powód', required: true }] },
    { name: 'koniecurlop', description: 'Kończy urlop', options: [{ name: 'uzytkownik', type: 6, description: 'Wybierz użytkownika', required: true }] },
    { name: 'zatrudnij', description: 'Zatrudnia pracownika', options: [{ name: 'uzytkownik', type: 6, description: 'Wybierz użytkownika', required: true }] },
    { name: 'zwolnij', description: 'Zwalnia pracownika', options: [{ name: 'uzytkownik', type: 6, description: 'Wybierz użytkownika', required: true }] },
    { name: 'listajob', description: 'Wyświetla listę pracowników' }
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
    
    if (['plus', 'minus', 'nagana', 'urlop', 'koniecurlop', 'zatrudnij', 'zwolnij', 'listajob'].includes(commandName) && !isManager) 
        return interaction.reply({ content: 'Brak uprawnień (wymagany Manager)!', ephemeral: true });

    if (commandName === 'zatrudnij') {
        const target = interaction.options.getMember('uzytkownik');
        const stazystaRoleId = config.pracownikRoles[config.pracownikRoles.length - 1];
        await target.roles.add([config.burgerShotRoleId, stazystaRoleId]);
        await wyslijDoArkusza({ action: 'zatrudnij', id: target.id, username: target.user.username });
        await interaction.reply(`✅ Zatrudniono ${target.user.username}.`);
    }

    if (commandName === 'zwolnij') {
        const target = interaction.options.getMember('uzytkownik');
        await target.roles.remove([config.burgerShotRoleId, ...config.pracownikRoles]).catch(console.error);
        await wyslijDoArkusza({ action: 'zwolnij', id: target.id });
        await interaction.reply(`❌ Zwolniono ${target.user.username}.`);
    }

    if (commandName === 'listajob') {
        const list = await pobierzListe();
        await interaction.reply(list.length ? `**Pracownicy:**\n${list.map(p => `• **${p[1]}**`).join('\n')}` : 'Brak pracowników.');
    }

    // Pozostałe komendy (plus, minus, nagana, urlop...) zostają bez zmian
    // (Możesz tu wkleić resztę swojej starej logiki)
});

client.login(process.env.TOKEN);
