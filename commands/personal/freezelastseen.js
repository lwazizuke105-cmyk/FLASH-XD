const fs = require('fs');
const path = require('path');
const { reply, box, normalizeJidNumber } = require('../../helper');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'freezelastseen.json');

function loadSettings() {
    try {
        if (!fs.existsSync(settingsFile)) {
            const fresh = { perBot: {}, prevPrivacy: {} };
            fs.writeFileSync(settingsFile, JSON.stringify(fresh, null, 2));
            return fresh;
        }
        const data = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
        if (!data.perBot) data.perBot = {};
        if (!data.prevPrivacy) data.prevPrivacy = {};
        return data;
    } catch (e) {
        return { perBot: {}, prevPrivacy: {} };
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

function getSavedPrivacy(botNumber) {
    return settings.prevPrivacy[botNumber] || { last: 'all', online: 'all' };
}

function savePrivacy(botNumber, last, online) {
    settings.prevPrivacy[botNumber] = { last: last || 'all', online: online || 'all' };
    saveSettings();
}

function attachFreezelastseenHandlers(sock) {
    const reassertIfEnabled = async () => {
        try {
            if (!sock.user || !sock.user.id) return;
            const botNumber = normalizeJidNumber(sock.user.id);
            if (!isEnabled(botNumber)) return;
            await sock.updateLastSeenPrivacy('none');
            await sock.updateOnlinePrivacy('match_last_seen');
        } catch (e) {
            console.log('FREEZELASTSEEN error:', e.message);
        }
    };

    if (sock.user && sock.user.id) reassertIfEnabled();

    sock.ev.on('connection.update', (update) => {
        if (update.connection === 'open') reassertIfEnabled();
    });
}

const FREEZELASTSEEN_COMMANDS = ['freezelastseen'];

async function handleFreezelastseenCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'freezelastseen': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can use this command.'));
                break;
            }
            const botNumber = normalizeJidNumber(sock.user.id);
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                if (!isEnabled(botNumber)) {
                    let last = 'all', online = 'all';
                    try {
                        const current = await sock.fetchPrivacySettings(true);
                        if (current) {
                            last = current.last || last;
                            online = current.online || online;
                        }
                    } catch (e) {}
                    savePrivacy(botNumber, last, online);
                }
                setEnabled(botNumber, true);
                try {
                    await sock.updateLastSeenPrivacy('none');
                    await sock.updateOnlinePrivacy('match_last_seen');
                } catch (e) {
                    console.log('FREEZELASTSEEN error:', e.message);
                }
                await reply(sock, jid, msg, box('FREEZELASTSEEN', 'FREEZELASTSEEN is now ON.\n\nYour last seen and online status are now hidden from everyone, until you turn this off.'));
            } else if (mode === 'off') {
                const prev = getSavedPrivacy(botNumber);
                setEnabled(botNumber, false);
                try {
                    await sock.updateLastSeenPrivacy(prev.last);
                    await sock.updateOnlinePrivacy(prev.online);
                } catch (e) {
                    console.log('FREEZELASTSEEN error:', e.message);
                }
                await reply(sock, jid, msg, box('FREEZELASTSEEN', 'FREEZELASTSEEN is now OFF.\n\nYour last seen visibility has been restored.'));
            } else {
                const state = isEnabled(botNumber) ? 'ON' : 'OFF';
                await reply(sock, jid, msg, box('FREEZELASTSEEN', 'Current status: ' + state + '\n\nUsage: freezelastseen on\nUsage: freezelastseen off'));
            }
            break;
        }
    }
}

module.exports = {
    handleFreezelastseenCommand,
    attachFreezelastseenHandlers,
    FREEZELASTSEEN_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});