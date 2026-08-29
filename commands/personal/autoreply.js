const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber, getMessageText } = require('../../helper');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'autoreply.json');

const COOLDOWN_MS = 30 * 60 * 1000;
const DEFAULT_MESSAGE = 'I am currently unavailable.\nI will get back to you as soon as possible.';

function loadSettings() {
    try {
        if (!fs.existsSync(settingsFile)) {
            const fresh = { perBot: {} };
            fs.writeFileSync(settingsFile, JSON.stringify(fresh, null, 2));
            return fresh;
        }
        const data = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
        if (!data.perBot) data.perBot = {};
        return data;
    } catch (e) {
        return { perBot: {} };
    }
}

function saveSettings() {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

let settings = loadSettings();
const cooldownCache = new Map();

function isEnabled(botNumber) {
    return !!settings.perBot[botNumber];
}

function setEnabled(botNumber, value) {
    settings.perBot[botNumber] = value;
    saveSettings();
}

function isOnCooldown(cacheKey) {
    const last = cooldownCache.get(cacheKey);
    if (!last) return false;
    return (Date.now() - last) < COOLDOWN_MS;
}

async function handleAutoreplyWatch(sock, msg) {
    try {
        if (!msg || !msg.key || msg.key.fromMe) return;
        const jid = msg.key.remoteJid;
        if (!jid || jid.endsWith('@g.us') || jid.endsWith('@newsletter')) return;
        if (!sock.user || !sock.user.id) return;

        const botNumber = normalizeJidNumber(sock.user.id);
        if (!isEnabled(botNumber)) return;

        const text = getMessageText(msg).trim();
        if (!text) return;

        const botPrefix = global.getBotPrefix(botNumber);
        if (botPrefix && text.toLowerCase().startsWith(botPrefix.toLowerCase())) return;

        const cacheKey = botNumber + ':' + jid;
        if (isOnCooldown(cacheKey)) return;
        cooldownCache.set(cacheKey, Date.now());

        await reply(sock, jid, msg, box('AUTO REPLY', DEFAULT_MESSAGE));
    } catch (e) {
        console.log('AUTOREPLY error:', e.message);
    }
}

const AUTOREPLY_COMMANDS = ['autoreply'];

async function handleAutoreplyCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'autoreply': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can use this command.'));
                break;
            }
            const botNumber = normalizeJidNumber(sock.user.id);
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                setEnabled(botNumber, true);
                await reply(sock, jid, msg, box('AUTOREPLY', 'AUTOREPLY is now ON.\n\nThe bot will automatically reply to private messages.'));
            } else if (mode === 'off') {
                setEnabled(botNumber, false);
                await reply(sock, jid, msg, box('AUTOREPLY', 'AUTOREPLY is now OFF.\n\nThe bot will stop automatically replying to private messages.'));
            } else {
                const state = isEnabled(botNumber) ? 'ON' : 'OFF';
                await reply(sock, jid, msg, box('AUTOREPLY', 'Current status: ' + state + '\n\nUsage: autoreply on\nUsage: autoreply off'));
            }
            break;
        }
    }
}

module.exports = {
    handleAutoreplyCommand,
    handleAutoreplyWatch,
    AUTOREPLY_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});