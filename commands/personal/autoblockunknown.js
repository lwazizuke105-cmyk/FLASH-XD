const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber } = require('../../helper');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'autoblockunknown.json');

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

function attachAutoblockunknownContacts(sock) {
    sock.ev.on('contacts.upsert', (contacts) => syncContacts(sock, contacts));
    sock.ev.on('contacts.update', (contacts) => syncContacts(sock, contacts));
    sock.ev.on('contacts.set', (data) => syncContacts(sock, data && data.contacts));
}

async function handleAutoblockunknownWatch(sock, msg) {
    try {
        if (!msg || !msg.key || msg.key.fromMe) return;
        const jid = msg.key.remoteJid;
        if (!jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) return;
        if (!sock.user || !sock.user.id) return;

        const botNumber = normalizeJidNumber(sock.user.id);
        if (!isEnabled(botNumber)) return;

        const senderNumber = normalizeJidNumber(jid);
        if (isSaved(botNumber, senderNumber)) return;

        await sock.updateBlockStatus(jid, 'block');
    } catch (e) {
        console.log('AUTOBLOCKUNKNOWN error:', e.message);
    }
}

const AUTOBLOCKUNKNOWN_COMMANDS = ['autoblockunknown'];

async function handleAutoblockunknownCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'autoblockunknown': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can use this command.'));
                break;
            }
            const botNumber = normalizeJidNumber(sock.user.id);
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                setEnabled(botNumber, true);
                await reply(sock, jid, msg, box('AUTOBLOCKUNKNOWN', 'AUTOBLOCKUNKNOWN is now ON.\n\nUnsaved numbers messaging in private chat will be blocked automatically. Saved contacts are never affected.'));
            } else if (mode === 'off') {
                setEnabled(botNumber, false);
                await reply(sock, jid, msg, box('AUTOBLOCKUNKNOWN', 'AUTOBLOCKUNKNOWN is now OFF.'));
            } else {
                const state = isEnabled(botNumber) ? 'ON' : 'OFF';
                await reply(sock, jid, msg, box('AUTOBLOCKUNKNOWN', 'Current status: ' + state + '\n\nUsage: autoblockunknown on\nUsage: autoblockunknown off'));
            }
            break;
        }
    }
}

module.exports = {
    handleAutoblockunknownCommand,
    handleAutoblockunknownWatch,
    attachAutoblockunknownContacts,
    AUTOBLOCKUNKNOWN_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});