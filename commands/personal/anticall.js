const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber } = require('../../helper');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'anticall.json');

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

async function handleAnticallCall(sock, calls) {
    try {
        if (!Array.isArray(calls)) return;
        if (!sock.user || !sock.user.id) return;

        const botNumber = normalizeJidNumber(sock.user.id);
        if (!isEnabled(botNumber)) return;

        for (const call of calls) {
            if (!call || !call.from || !call.id) continue;
            if (call.status !== 'offer') continue;

            try {
                await sock.rejectCall(call.id, call.from);
            } catch (e) {}

            await sock.updateBlockStatus(call.from, 'block');
        }
    } catch (e) {
        console.log('ANTICALL error:', e.message);
    }
}

function attachAnticall(sock) {
    sock.ev.on('call', (calls) => handleAnticallCall(sock, calls));
}

const ANTICALL_COMMANDS = ['anticall'];

async function handleAnticallCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'anticall': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can use this command.'));
                break;
            }
            const botNumber = normalizeJidNumber(sock.user.id);
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                setEnabled(botNumber, true);
                await reply(sock, jid, msg, box('ANTICALL', 'ANTICALL is now ON.\n\nAll incoming voice and video calls will be rejected and the caller will be blocked automatically.'));
            } else if (mode === 'off') {
                setEnabled(botNumber, false);
                await reply(sock, jid, msg, box('ANTICALL', 'ANTICALL is now OFF.'));
            } else {
                const state = isEnabled(botNumber) ? 'ON' : 'OFF';
                await reply(sock, jid, msg, box('ANTICALL', 'Current status: ' + state + '\n\nUsage: anticall on\nUsage: anticall off'));
            }
            break;
        }
    }
}

module.exports = {
    handleAnticallCommand,
    attachAnticall,
    ANTICALL_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
