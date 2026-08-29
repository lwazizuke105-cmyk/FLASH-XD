const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber, getMessageText } = require('../../helper');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'autosavedeleted.json');

const CACHE_LIMIT = 500;
const CACHE_MAX_AGE_MS = 60 * 60 * 1000;

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
const messageCache = new Map();

function isEnabled(botNumber) {
    return !!settings.perBot[botNumber];
}

function setEnabled(botNumber, value) {
    settings.perBot[botNumber] = value;
    saveSettings();
}

function cacheKeyFor(jid, id) {
    return jid + ':' + id;
}

function pruneCache() {
    if (messageCache.size <= CACHE_LIMIT) return;
    const now = Date.now();
    for (const [key, value] of messageCache) {
        if (now - value.cachedAt > CACHE_MAX_AGE_MS) {
            messageCache.delete(key);
        }
    }
    while (messageCache.size > CACHE_LIMIT) {
        const oldestKey = messageCache.keys().next().value;
        messageCache.delete(oldestKey);
    }
}

function cacheIncomingMessage(sock, msg) {
    try {
        if (!msg || !msg.key || msg.key.fromMe) return;
        const jid = msg.key.remoteJid;
        if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@newsletter')) return;
        if (!msg.message) return;

        const key = cacheKeyFor(jid, msg.key.id);
        messageCache.set(key, {
            jid,
            sender: msg.key.participant || jid,
            text: getMessageText(msg),
            message: msg.message,
            cachedAt: Date.now()
        });
        pruneCache();
    } catch (e) {}
}

async function handleDeletionUpdate(sock, updates) {
    try {
        if (!Array.isArray(updates)) return;
        if (!sock.user || !sock.user.id) return;

        const botNumber = normalizeJidNumber(sock.user.id);
        if (!isEnabled(botNumber)) return;

        for (const update of updates) {
            if (!update || !update.key) continue;
            const isRevoke = update.update && (
                update.update.message === null
                || update.update.messageStubType === 1
                || (update.update.message && update.update.message.protocolMessage && update.update.message.protocolMessage.type === 0)
            );
            if (!isRevoke) continue;

            const jid = update.key.remoteJid;
            if (!jid || jid.endsWith('@g.us')) continue;

            const key = cacheKeyFor(jid, update.key.id);
            const cached = messageCache.get(key);
            if (!cached) continue;

            const senderNumber = normalizeJidNumber(cached.sender);
            const ownJid = sock.user.id;
            const header = 'Deleted message from: ' + senderNumber;

            if (cached.text) {
                await sock.sendMessage(ownJid, { text: box('AUTOSAVEDELETED', header + '\n\n' + cached.text) });
            } else {
                await sock.sendMessage(ownJid, { text: box('AUTOSAVEDELETED', header + '\n\n[Non-text message deleted - content type not recoverable]') });
            }

            messageCache.delete(key);
        }
    } catch (e) {
        console.log('AUTOSAVEDELETED error:', e.message);
    }
}

function attachAutosavedeleted(sock) {
    sock.ev.on('messages.upsert', (m) => {
        if (!m || !Array.isArray(m.messages)) return;
        for (const msg of m.messages) {
            cacheIncomingMessage(sock, msg);
        }
    });
    sock.ev.on('messages.update', (updates) => handleDeletionUpdate(sock, updates));
}

const AUTOSAVEDELETED_COMMANDS = ['autosavedeleted'];

async function handleAutosavedeletedCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'autosavedeleted': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can use this command.'));
                break;
            }
            const botNumber = normalizeJidNumber(sock.user.id);
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                setEnabled(botNumber, true);
                await reply(sock, jid, msg, box('AUTOSAVEDELETED', 'AUTOSAVEDELETED is now ON.\n\nIf someone deletes a message they sent you in a private chat, the bot will resend the original content to your own chat.'));
            } else if (mode === 'off') {
                setEnabled(botNumber, false);
                await reply(sock, jid, msg, box('AUTOSAVEDELETED', 'AUTOSAVEDELETED is now OFF.'));
            } else {
                const state = isEnabled(botNumber) ? 'ON' : 'OFF';
                await reply(sock, jid, msg, box('AUTOSAVEDELETED', 'Current status: ' + state + '\n\nUsage: autosavedeleted on\nUsage: autosavedeleted off'));
            }
            break;
        }
    }
}

module.exports = {
    handleAutosavedeletedCommand,
    attachAutosavedeleted,
    AUTOSAVEDELETED_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
