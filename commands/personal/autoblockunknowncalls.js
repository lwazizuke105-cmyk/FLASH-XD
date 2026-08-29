const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber } = require('../../helper');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'autoblockunknowncalls.json');

function loadSettings() {
    try {
        if (!fs.existsSync(settingsFile)) {
            const fresh = { perBot: {}, savedContacts: {} };
            fs.writeFileSync(settingsFile, JSON.stringify(fresh, null, 2));
            return fresh;
        }
        const data = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
        if (!data.perBot) data.perBot = {};
        if (!data.savedContacts) data.savedContacts = {};
        return data;
    } catch (e) {
        return { perBot: {}, savedContacts: {} };
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

function isSaved(botNumber, number) {
    return !!(settings.savedContacts[botNumber] && settings.savedContacts[botNumber][number]);
}

function syncContacts(sock, contacts) {
    try {
        if (!sock.user || !sock.user.id) return;
        if (!Array.isArray(contacts)) return;

        const botNumber = normalizeJidNumber(sock.user.id);
        if (!settings.savedContacts[botNumber]) settings.savedContacts[botNumber] = {};

        let changed = false;
        for (const contact of contacts) {
            if (!contact || !contact.id || !contact.name) continue;
            const number = normalizeJidNumber(contact.id);
            if (!number) continue;
            if (!settings.savedContacts[botNumber][number]) {
                settings.savedContacts[botNumber][number] = true;
                changed = true;
            }
        }
        if (changed) saveSettings();
    } catch (e) {}
}

async function handleAutoblockunknowncallsCall(sock, calls) {
    try {
        if (!Array.isArray(calls)) return;
        if (!sock.user || !sock.user.id) return;

        const botNumber = normalizeJidNumber(sock.user.id);
        if (!isEnabled(botNumber)) return;

        for (const call of calls) {
            if (!call || !call.from || !call.id) continue;
            if (call.status !== 'offer') continue;

            const callerNumber = normalizeJidNumber(call.from);
            if (isSaved(botNumber, callerNumber)) continue;

            try {
                await sock.rejectCall(call.id, call.from);
            } catch (e) {}

            await sock.updateBlockStatus(call.from, 'block');
        }
    } catch (e) {
        console.log('AUTOBLOCKUNKNOWNCALLS error:', e.message);
    }
}

function attachAutoblockunknowncalls(sock) {
    sock.ev.on('contacts.upsert', (contacts) => syncContacts(sock, contacts));
    sock.ev.on('contacts.update', (contacts) => syncContacts(sock, contacts));
    sock.ev.on('contacts.set', (data) => syncContacts(sock, data && data.contacts));
    sock.ev.on('call', (calls) => handleAutoblockunknowncallsCall(sock, calls));
}

const AUTOBLOCKUNKNOWNCALLS_COMMANDS = ['autoblockunknowncalls'];

async function handleAutoblockunknowncallsCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'autoblockunknowncalls': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can use this command.'));
                break;
            }
            const botNumber = normalizeJidNumber(sock.user.id);
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                setEnabled(botNumber, true);
                await reply(sock, jid, msg, box('AUTOBLOCKUNKNOWNCALLS', 'AUTOBLOCKUNKNOWNCALLS is now ON.\n\nCalls from unsaved numbers will be rejected and blocked automatically. Saved contacts are never affected.'));
            } else if (mode === 'off') {
                setEnabled(botNumber, false);
                await reply(sock, jid, msg, box('AUTOBLOCKUNKNOWNCALLS', 'AUTOBLOCKUNKNOWNCALLS is now OFF.'));
            } else {
                const state = isEnabled(botNumber) ? 'ON' : 'OFF';
                await reply(sock, jid, msg, box('AUTOBLOCKUNKNOWNCALLS', 'Current status: ' + state + '\n\nUsage: autoblockunknowncalls on\nUsage: autoblockunknowncalls off'));
            }
            break;
        }
    }
}

module.exports = {
    handleAutoblockunknowncallsCommand,
    attachAutoblockunknowncalls,
    AUTOBLOCKUNKNOWNCALLS_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});