const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber } = require('../../helper');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'autostatuslike.json');

const LIKE_EMOJIS = ['❤️', '🔥', '😍', '👍', '😂', '😮', '👏', '💯', '😎', '✨'];

function getRandomEmoji() {
    return LIKE_EMOJIS[Math.floor(Math.random() * LIKE_EMOJIS.length)];
}

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

async function handleAutostatuslikeWatch(sock, msg) {
    try {
        if (!msg || !msg.key) return;
        if (msg.key.remoteJid !== 'status@broadcast') return;
        if (msg.key.fromMe) return;
        if (!sock.user || !sock.user.id) return;

        const botNumber = normalizeJidNumber(sock.user.id);
        if (!isEnabled(botNumber)) return;
        try {
            await sock.readMessages([msg.key]);
        } catch (readErr) {
            console.log('AUTOSTATUSLIKE read error:', readErr.message);
        }

        await sock.sendMessage('status@broadcast', {
            react: {
                text: getRandomEmoji(),
                key: msg.key
            }
        }, {
            statusJidList: [msg.key.participant, sock.user.id]
        });
    } catch (e) {
        console.log('AUTOSTATUSLIKE error:', e.message);
    }
}

const AUTOSTATUSLIKE_COMMANDS = ['autostatuslike'];

async function handleAutostatuslikeCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'autostatuslike': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can use this command.'));
                break;
            }
            const botNumber = normalizeJidNumber(sock.user.id);
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                setEnabled(botNumber, true);
                await reply(sock, jid, msg, box('AUTOSTATUSLIKE', 'AUTOSTATUSLIKE is now ON.\n\nThe bot will automatically react to all contact statuses.'));
            } else if (mode === 'off') {
                setEnabled(botNumber, false);
                await reply(sock, jid, msg, box('AUTOSTATUSLIKE', 'AUTOSTATUSLIKE is now OFF.'));
            } else {
                const state = isEnabled(botNumber) ? 'ON' : 'OFF';
                await reply(sock, jid, msg, box('AUTOSTATUSLIKE', 'Current status: ' + state + '\n\nUsage: autostatuslike on\nUsage: autostatuslike off'));
            }
            break;
        }
    }
}

module.exports = {
    handleAutostatuslikeCommand,
    handleAutostatuslikeWatch,
    AUTOSTATUSLIKE_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});