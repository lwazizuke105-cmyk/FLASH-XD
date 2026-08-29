const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber } = require('../../helper');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'autoblockgroup.json');

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

async function handleAutoblockgroupParticipantsUpdate(sock, update) {
    try {
        if (!update || update.action !== 'add') return;
        if (!sock.user || !sock.user.id) return;

        const botNumber = normalizeJidNumber(sock.user.id);
        if (!isEnabled(botNumber)) return;

        const addedNumbers = (update.participants || []).map(normalizeJidNumber);
        if (!addedNumbers.includes(botNumber)) return;

        const jid = update.id;
        try {
            await sock.sendMessage(jid, { text: box('AUTOBLOCKGROUP', 'This bot is set to auto-leave groups. Leaving now.') });
        } catch (e) {}

        await new Promise(resolve => setTimeout(resolve, 1000));
        await sock.groupLeave(jid);
    } catch (e) {
        console.log('AUTOBLOCKGROUP error:', e.message);
    }
}

function attachAutoblockgroup(sock) {
    sock.ev.on('group-participants.update', (update) => handleAutoblockgroupParticipantsUpdate(sock, update));
}

const AUTOBLOCKGROUP_COMMANDS = ['autoblockgroup'];

async function handleAutoblockgroupCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'autoblockgroup': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can use this command.'));
                break;
            }
            const botNumber = normalizeJidNumber(sock.user.id);
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                setEnabled(botNumber, true);
                await reply(sock, jid, msg, box('AUTOBLOCKGROUP', 'AUTOBLOCKGROUP is now ON.\n\nIf the bot is added to any group, it will automatically leave that group.'));
            } else if (mode === 'off') {
                setEnabled(botNumber, false);
                await reply(sock, jid, msg, box('AUTOBLOCKGROUP', 'AUTOBLOCKGROUP is now OFF.'));
            } else {
                const state = isEnabled(botNumber) ? 'ON' : 'OFF';
                await reply(sock, jid, msg, box('AUTOBLOCKGROUP', 'Current status: ' + state + '\n\nUsage: autoblockgroup on\nUsage: autoblockgroup off'));
            }
            break;
        }
    }
}

module.exports = {
    handleAutoblockgroupCommand,
    attachAutoblockgroup,
    AUTOBLOCKGROUP_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
