const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber } = require('../../helper');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'alwaysonline.json');

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

async function handleAlwaysonlineWatch(sock, msg) {
    try {
        if (!sock.user || !sock.user.id) return;

        const botNumber = normalizeJidNumber(sock.user.id);
        if (!isEnabled(botNumber)) return;

        await sock.sendPresenceUpdate('available');
    } catch (e) {
        console.log('ALWAYSONLINE error:', e.message);
    }
}

const ALWAYSONLINE_COMMANDS = ['alwaysonline'];

async function handleAlwaysonlineCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'alwaysonline': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can use this command.'));
                break;
            }
            const botNumber = normalizeJidNumber(sock.user.id);
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                setEnabled(botNumber, true);
                await sock.sendPresenceUpdate('available');
                await reply(sock, jid, msg, box('ALWAYSONLINE', 'ALWAYSONLINE is now ON.\n\nThe bot will always appear online.'));
            } else if (mode === 'off') {
                setEnabled(botNumber, false);
                await reply(sock, jid, msg, box('ALWAYSONLINE', 'ALWAYSONLINE is now OFF.'));
            } else {
                const state = isEnabled(botNumber) ? 'ON' : 'OFF';
                await reply(sock, jid, msg, box('ALWAYSONLINE', 'Current status: ' + state + '\n\nUsage: alwaysonline on\nUsage: alwaysonline off'));
            }
            break;
        }
    }
}

module.exports = {
    handleAlwaysonlineCommand,
    handleAlwaysonlineWatch,
    ALWAYSONLINE_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});