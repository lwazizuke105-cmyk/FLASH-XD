const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber } = require('../../helper');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'autoarchive.json');

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

function isEnabled(botNumber) {
    return !!settings.perBot[botNumber];
}

function setEnabled(botNumber, value) {
    settings.perBot[botNumber] = value;
    saveSettings();
}

async function handleAutoarchiveWatch(sock, msg) {
    try {
        if (!msg || !msg.key || msg.key.fromMe) return;
        const jid = msg.key.remoteJid;
        if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter')) return;
        if (!sock.user || !sock.user.id) return;

        const botNumber = normalizeJidNumber(sock.user.id);
        if (!isEnabled(botNumber)) return;

        await sock.chatModify({
            archive: true,
            lastMessages: [{ key: msg.key, messageTimestamp: msg.messageTimestamp }]
        }, jid);
    } catch (e) {
        console.log('AUTOARCHIVE error:', e.message);
    }
}

const AUTOARCHIVE_COMMANDS = ['autoarchive'];

async function handleAutoarchiveCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'autoarchive': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can use this command.'));
                break;
            }
            const botNumber = normalizeJidNumber(sock.user.id);
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                setEnabled(botNumber, true);
                await reply(sock, jid, msg, box('AUTOARCHIVE', 'AUTOARCHIVE is now ON.\n\nAny chat that sends the bot a new message will be archived automatically, keeping the inbox clean.'));
            } else if (mode === 'off') {
                setEnabled(botNumber, false);
                await reply(sock, jid, msg, box('AUTOARCHIVE', 'AUTOARCHIVE is now OFF.'));
            } else {
                const state = isEnabled(botNumber) ? 'ON' : 'OFF';
                await reply(sock, jid, msg, box('AUTOARCHIVE', 'Current status: ' + state + '\n\nUsage: autoarchive on\nUsage: autoarchive off'));
            }
            break;
        }
    }
}

module.exports = {
    handleAutoarchiveCommand,
    handleAutoarchiveWatch,
    AUTOARCHIVE_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
