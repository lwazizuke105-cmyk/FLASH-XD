const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { reply, box, normalizeJidNumber, getBaileys } = require('../../helper');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'autostatusdownload.json');

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

async function handleAutostatusdownloadWatch(sock, msg) {
    try {
        if (!msg || !msg.key) return;
        if (msg.key.remoteJid !== 'status@broadcast') return;
        if (msg.key.fromMe) return;
        if (!sock.user || !sock.user.id) return;

        const botNumber = normalizeJidNumber(sock.user.id);
        if (!isEnabled(botNumber)) return;
        if (!msg.message) return;

        let type = null;
        if (msg.message.imageMessage) type = 'image';
        else if (msg.message.videoMessage) type = 'video';
        else if (msg.message.audioMessage) type = 'audio';
        if (!type) return;

        const { downloadMediaMessage } = await getBaileys();
        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { logger: pino({ level: 'silent' }) }
        );
        if (!buffer) return;

        const statusOwner = normalizeJidNumber(msg.key.participant || '');
        const caption = 'STATUS SAVED\nFrom: +' + statusOwner;
        const selfJid = sock.user.id;

        if (type === 'image') {
            await sock.sendMessage(selfJid, { image: buffer, caption });
        } else if (type === 'video') {
            await sock.sendMessage(selfJid, { video: buffer, caption });
        } else if (type === 'audio') {
            await sock.sendMessage(selfJid, { audio: buffer, mimetype: 'audio/mp4', caption });
        }
    } catch (e) {
        console.log('AUTOSTATUSDOWNLOAD error:', e.message);
    }
}

const AUTOSTATUSDOWNLOAD_COMMANDS = ['autostatusdownload'];

async function handleAutostatusdownloadCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'autostatusdownload': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can use this command.'));
                break;
            }
            const botNumber = normalizeJidNumber(sock.user.id);
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                setEnabled(botNumber, true);
                await reply(sock, jid, msg, box('AUTOSTATUSDOWNLOAD', 'AUTOSTATUSDOWNLOAD is now ON.\n\nThe bot will automatically save status photos/videos/audio to your own chat.'));
            } else if (mode === 'off') {
                setEnabled(botNumber, false);
                await reply(sock, jid, msg, box('AUTOSTATUSDOWNLOAD', 'AUTOSTATUSDOWNLOAD is now OFF.'));
            } else {
                const state = isEnabled(botNumber) ? 'ON' : 'OFF';
                await reply(sock, jid, msg, box('AUTOSTATUSDOWNLOAD', 'Current status: ' + state + '\n\nUsage: autostatusdownload on\nUsage: autostatusdownload off'));
            }
            break;
        }
    }
}

module.exports = {
    handleAutostatusdownloadCommand,
    handleAutostatusdownloadWatch,
    AUTOSTATUSDOWNLOAD_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});