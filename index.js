require('dotenv').config();
const { Client, RichPresence } = require('discord.js-selfbot-v13');
const express = require('express');
const config = require('./config');

const tokenString = process.env.DISCORD_TOKENS || process.env.DISCORD_TOKEN;
const appIdsString = process.env.APPLICATION_IDS || process.env.APPLICATION_ID;
const PORT = process.env.PORT || 3000;

if (!tokenString || !appIdsString) {
    console.log('[ERROR] Token ya Application ID nahi mila! .env file me DISCORD_TOKENS aur APPLICATION_IDS check karo.');
    process.exit(1);
}

// Split multiple tokens using comma
const tokens = tokenString.split(',').map(t => t.trim()).filter(b => b);
const appIds = appIdsString.split(',').map(a => a.trim()).filter(b => b);

// ==========================================
// YAHAN STATUS CHANGE KAREIN (SAB ACCOUNT KE LIYE)
// Options: 'online', 'idle', 'dnd', 'invisible'
const GLOBAL_STATUS = 'dnd'; 
// ==========================================

const app = express();

// Keep-alive server for hosting
app.get('/', (req, res) => res.send(`Discord RPC is Online 24/7 for ${tokens.length} account(s)`));
app.listen(PORT, () => console.log(`[SERVER] Active on port ${PORT}`));

// Multi-client logic
const delay = ms => new Promise(res => setTimeout(res, ms));

async function startClients() {
    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        const client = new Client({ checkUpdate: false });
        const APP_ID = appIds[index] || appIds[0]; // If not enough App IDs, fallback to the first one

        await new Promise((resolve) => {
            client.on('ready', async () => {
                console.log(`[DISCORD] Account ${index + 1} Logged in as ${client.user.tag}`);

                // Fetch account specific config from array
                const accConfig = Array.isArray(config) ? (config[index] || config[0]) : config;

                // Sabko 5 Lakh hours ka time yahan fix kar diya, jis se Profile 1 ka time bhi theek se show hoga
                let startTimestampMs = Date.now() - (500000 * 60 * 60 * 1000);
                const discordEpoch = 1420070400000;
                if (startTimestampMs <= discordEpoch) {
                    startTimestampMs = discordEpoch;
                }

                const typeStr = (accConfig.activityType || 'PLAYING').toUpperCase();
                // Custom RPC using RichPresence class
                const r = new RichPresence(client)
                    .setApplicationId(APP_ID)
                    .setType(typeStr)
                    .setState(accConfig.state)
                    .setName(accConfig.name)
                    .setDetails(accConfig.details)
                    .setStartTimestamp(startTimestampMs)
                    .setAssetsLargeImage(accConfig.largeImage || undefined)
                    .setAssetsLargeText(accConfig.largeImageText || undefined)
                    .setAssetsSmallImage(accConfig.smallImage || undefined)
                    .setAssetsSmallText(accConfig.smallImageText || undefined);

                if (typeStr === 'STREAMING') {
                    // Streaming ke liye URL zaroori hota hai
                    r.setURL(accConfig.url || 'https://twitch.tv/discord');
                }

                if (accConfig.button1Name && accConfig.button1URL) {
                    r.addButton(accConfig.button1Name, accConfig.button1URL);
                }
                if (accConfig.button2Name && accConfig.button2URL) {
                    r.addButton(accConfig.button2Name, accConfig.button2URL);
                }

                client.user.setActivity(r);
                client.user.setStatus(GLOBAL_STATUS); // Sab accounts ka status yahan se control hoga

                console.log(`[SUCCESS] Account ${index + 1} (${client.user.tag}) - RPC Applied! Type: ${accConfig.activityType}`);
                
                // Agli ID ke liye 5-6 seconds ruko taaki ban na ho aur sequence kharab na ho
                await delay(6000);
                resolve();
            });

            client.login(token).catch((err) => {
                console.log(`[ERROR] Account ${index + 1} Login Failed:`, err.message);
                resolve(); // Agar login fail hota hai, tab bhi next profile chalao
            });
        });
    }
}

startClients();

function getActivityType(type) {
    switch ((type || 'PLAYING').toUpperCase()) {
        case 'PLAYING': return 0;
        case 'STREAMING': return 1;
        case 'LISTENING': return 2;
        case 'WATCHING': return 3;
        case 'COMPETING': return 5;
        default: return 0;
    }
}

// Anti-crash system
process.on('unhandledRejection', (r) => console.log('[ANTI-CRASH] Unhandled Rejection:', r));
process.on('uncaughtException', (e) => console.log('[ANTI-CRASH] Uncaught Exception:', e.message));
process.on('uncaughtExceptionMonitor', () => {});
