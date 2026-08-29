const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber } = require('../../helper');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'automute.json');

const MUTE_DURATION_MS = 8 * 60 * 60 * 1000;

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

async function handleAutomuteWatch(sock, msg) {
    try {
        if (!msg || !msg.key || msg.key.fromMe) return;
        const jid = msg.key.remoteJid;
        if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter')) return;
        if (!sock.user || !sock.user.id) return;

        const botNumber = normalizeJidNumber(sock.user.id);
        if (!isEnabled(botNumber)) return;

        await sock.chatModify({
            mute: Date.now() + MUTE_DURATION_MS
        }, jid);
    } catch (e) {
        console.log('AUTOMUTE error:', e.message);
    }
}

const AUTOMUTE_COMMANDS = ['automute'];

async function handleAutomuteCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'automute': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can use this command.'));
                break;
            }
            const botNumber = normalizeJidNumber(sock.user.id);
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                setEnabled(botNumber, true);
                await reply(sock, jid, msg, box('AUTOMUTE', 'AUTOMUTE is now ON.\n\nAny chat that sends the bot a new message will be muted automatically, keeping notifications silent.'));
            } else if (mode === 'off') {
                setEnabled(botNumber, false);
                await reply(sock, jid, msg, box('AUTOMUTE', 'AUTOMUTE is now OFF.'));
            } else {
                const state = isEnabled(botNumber) ? 'ON' : 'OFF';
                await reply(sock, jid, msg, box('AUTOMUTE', 'Current status: ' + state + '\n\nUsage: automute on\nUsage: automute off'));
            }
            break;
        }
    }
}

module.exports = {
    handleAutomuteCommand,
    handleAutomuteWatch,
    AUTOMUTE_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
