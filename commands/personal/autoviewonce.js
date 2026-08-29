const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { reply, box, normalizeJidNumber, getBaileys } = require('../../helper');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const settingsFile = path.join(dataDir, 'autoviewonce.json');

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

// View-once media can arrive wrapped in different envelopes depending on the
// WhatsApp/Baileys version: viewOnceMessage, viewOnceMessageV2,
// viewOnceMessageV2Extension, or as a plain imageMessage/videoMessage/
// audioMessage with a `viewOnce: true` flag set directly on it.
function extractViewOnceContent(message) {
    if (!message) return null;

    const wrapper = message.viewOnceMessage
        || message.viewOnceMessageV2
        || message.viewOnceMessageV2Extension;
    const inner = wrapper ? wrapper.message : message;
    if (!inner) return null;

    if (inner.imageMessage && (inner.imageMessage.viewOnce || wrapper)) {
        return { type: 'image', content: inner.imageMessage };
    }
    if (inner.videoMessage && (inner.videoMessage.viewOnce || wrapper)) {
        return { type: 'video', content: inner.videoMessage };
    }
    if (inner.audioMessage && (inner.audioMessage.viewOnce || wrapper)) {
        return { type: 'audio', content: inner.audioMessage };
    }
    return null;
}

async function handleAutoviewonceWatch(sock, msg) {
    try {
        if (!msg || !msg.key || msg.key.fromMe) return;
        if (!msg.message) return;
        if (!sock.user || !sock.user.id) return;

        const botNumber = normalizeJidNumber(sock.user.id);
        if (!isEnabled(botNumber)) return;

        const found = extractViewOnceContent(msg.message);
        if (!found) return;

        const { downloadMediaMessage } = await getBaileys();
        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { logger: pino({ level: 'silent' }) }
        );
        if (!buffer) return;

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const senderNumber = normalizeJidNumber(senderJid);
        const caption = 'View-once media saved.\nFrom: ' + senderNumber
            + (found.content.caption ? ('\nCaption: ' + found.content.caption) : '');

        const ownJid = sock.user.id;
        if (found.type === 'image') {
            await sock.sendMessage(ownJid, { image: buffer, caption: box('AUTOVIEWONCE', caption) });
        } else if (found.type === 'video') {
            await sock.sendMessage(ownJid, { video: buffer, caption: box('AUTOVIEWONCE', caption) });
        } else if (found.type === 'audio') {
            await sock.sendMessage(ownJid, { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
            await sock.sendMessage(ownJid, { text: box('AUTOVIEWONCE', caption) });
        }
    } catch (e) {
        console.log('AUTOVIEWONCE error:', e.message);
    }
}

const AUTOVIEWONCE_COMMANDS = ['autoviewonce'];

async function handleAutoviewonceCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'autoviewonce': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can use this command.'));
                break;
            }
            const botNumber = normalizeJidNumber(sock.user.id);
            const mode = (params[0] || '').toLowerCase();
            if (mode === 'on') {
                setEnabled(botNumber, true);
                await reply(sock, jid, msg, box('AUTOVIEWONCE', 'AUTOVIEWONCE is now ON.\n\nAny view-once photo, video, or voice note sent to the bot will be saved and resent to your own chat.'));
            } else if (mode === 'off') {
                setEnabled(botNumber, false);
                await reply(sock, jid, msg, box('AUTOVIEWONCE', 'AUTOVIEWONCE is now OFF.'));
            } else {
                const state = isEnabled(botNumber) ? 'ON' : 'OFF';
                await reply(sock, jid, msg, box('AUTOVIEWONCE', 'Current status: ' + state + '\n\nUsage: autoviewonce on\nUsage: autoviewonce off'));
            }
            break;
        }
    }
}

module.exports = {
    handleAutoviewonceCommand,
    handleAutoviewonceWatch,
    AUTOVIEWONCE_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
