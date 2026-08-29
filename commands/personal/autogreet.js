const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber } = require('../../helper');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'autogreet.json');

const DEFAULT_MESSAGE = 'Hello! 👋\nThanks for reaching out. I will get back to you as soon as possible.';

function loadSettings() {
    try {
        if (!fs.existsSync(settingsFile)) {
            const fresh = { perBot: {}, greeted: {} };
            fs.writeFileSync(settingsFile, JSON.stringify(fresh, null, 2));
            return fresh;
        }
        const data = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
        if (!data.perBot) data.perBot = {};
        if (!data.greeted) data.greeted = {};
        return data;
    } catch (e) {
        return { perBot: {}, greeted: {} };
    }
}

function saveSettings() {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

let settings = loadSettings();

function isEnabled(botNumber) {
    return !!settings.perBot[botNumber];
}

function setEnabled(botNumber, value) {
    settings.perBot[botNumber] = value;
    saveSettings();
}

function wasGreeted(botNumber, number) {
    return !!(settings.greeted[botNumber] && settings.greeted[botNumber][number]);
}

function markGreeted(botNumber, number) {
    if (!settings.greeted[botNumber]) settings.greeted[botNumber] = {};
    settings.greeted[botNumber][number] = true;
    saveSettings();
}

async function handleAutogreetWatch(sock, msg) {
    try {
        if (!msg || !msg.key || msg.key.fromMe) return;
        const jid = msg.key.remoteJid;
        if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@newsletter')) return;
        if (!sock.user || !sock.user.id) return;

        const botNumber = normalizeJidNumber(sock.user.id);
        if (!isEnabled(botNumber)) return;

        const senderNumber = normalizeJidNumber(jid);
        if (wasGreeted(botNumber, senderNumber)) return;

        markGreeted(botNumber, senderNumber);
        await reply(sock, jid, msg, box('WELCOME', DEFAULT_MESSAGE));
    } catch (e) {
        console.log('AUTOGREET error:', e.message);
    }
}

const AUTOGREET_COMMANDS = ['autogreet'];

async function handleAutogreetCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'autogreet': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can use this command.'));
                break;
            }
            const botNumber = normalizeJidNumber(sock.user.id);
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                setEnabled(botNumber, true);
                await reply(sock, jid, msg, box('AUTOGREET', 'AUTOGREET is now ON.\n\nThe bot will send a one-time welcome message the first time a new number messages it privately.'));
            } else if (mode === 'off') {
                setEnabled(botNumber, false);
                await reply(sock, jid, msg, box('AUTOGREET', 'AUTOGREET is now OFF.'));
            } else {
                const state = isEnabled(botNumber) ? 'ON' : 'OFF';
                await reply(sock, jid, msg, box('AUTOGREET', 'Current status: ' + state + '\n\nUsage: autogreet on\nUsage: autogreet off'));
            }
            break;
        }
    }
}

module.exports = {
    handleAutogreetCommand,
    handleAutogreetWatch,
    AUTOGREET_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
