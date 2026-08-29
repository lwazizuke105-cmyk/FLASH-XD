require('./config');
const fs = require('fs');
const path = require('path');
const os = require('os');
const pino = require('pino');
const { execSync } = require('child_process');

let _baileysLib = null;
const getBaileys = async () => {
    if (!_baileysLib) {
        _baileysLib = await import('@mrlegendbot/baileys');
    }
    return _baileysLib;
};

const getMessageText = (msg) => {
    const message = msg.message;
    if (!message) return '';
    return message.conversation
        || message.extendedTextMessage?.text
        || message.imageMessage?.caption
        || message.videoMessage?.caption
        || '';
};

function getQuotedText(msg) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (!ctx || !ctx.quotedMessage) return '';
    const q = ctx.quotedMessage;
    return q.conversation || q.extendedTextMessage?.text || '';
}

async function downloadQuotedMedia(msg) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (!ctx || !ctx.quotedMessage) return null;
    const q = ctx.quotedMessage;

    let type = null;
    if (q.imageMessage) type = 'image';
    else if (q.audioMessage) type = 'audio';
    else if (q.videoMessage) type = 'video';
    else if (q.stickerMessage) type = 'sticker';
    else if (q.conversation || q.extendedTextMessage) type = 'text';

    if (!type) return null;
    if (type === 'text') return { type, buffer: null };

    const quotedMsg = {
        key: {
            remoteJid: msg.key.remoteJid,
            id: ctx.stanzaId,
            participant: ctx.participant,
            fromMe: false
        },
        message: q
    };

    try {
        const { downloadMediaMessage } = await getBaileys();
        const buffer = await downloadMediaMessage(
            quotedMsg,
            'buffer',
            {},
            { logger: pino({ level: 'silent' }) }
        );
        return { type, buffer };
    } catch (e) {
        return null;
    }
}

const box = (title, body) => {
    const lines = String(body).split('\n').map(l => '┃ ' + l).join('\n');
    return '╭━━━━━━━━━━━━━━━━━━━━\n'
        + '┃ ' + title + '\n'
        + '┃\n'
        + lines + '\n'
        + '╰━━━━━━━━━━━━━━━━━━━━';
};

function effectiveChannelName(sock) {
    try {
        const botNumber = normalizeJidNumber(sock.user.id);
        const custom = global.getBotCustomTextIfEnabled ? global.getBotCustomTextIfEnabled(botNumber, 'name') : null;
        return custom || global.chname;
    } catch (e) {
        return global.chname;
    }
}

const reply = async (sock, jid, msg, content, extra = {}) => {
    try {
        const payload = (typeof content === 'string')
            ? { text: content }
            : { ...content };

        payload.contextInfo = {
            ...(payload.contextInfo || {}),
            forwardingScore: 999,
            isForwarded: true,
            mentionedJid: extra.mentions || payload.mentions || payload.contextInfo?.mentionedJid,
            forwardedNewsletterMessageInfo: {
                newsletterName: effectiveChannelName(sock),
                newsletterJid: global.chid,
            }
        };

        return await sock.sendMessage(jid, payload, { quoted: msg, ...(extra.options || {}) });
    } catch (e) {
        console.log('REPLY ERROR:', e);
        return null;
    }
};

const replyPairCode = async (sock, jid, msg, number, code) => {
    try {
        const { generateWAMessageFromContent, proto } = await getBaileys();
        const interactiveMsg = generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage: proto.Message.InteractiveMessage.create({
                        contextInfo: {
                            forwardingScore: 999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterName: effectiveChannelName(sock),
                                newsletterJid: global.chid,
                            }
                        },
                        body: proto.Message.InteractiveMessage.Body.create({
                            text: '🔐 *Your Pair Code:*\n\n' + code + '\n\nCOPY THIS CODE TO PAIR YOUR BOT'
                        }),
                        footer: proto.Message.InteractiveMessage.Footer.create({
                            text: 'Number: +' + number
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                            buttons: [
                                {
                                    name: 'cta_copy',
                                    buttonParamsJson: JSON.stringify({
                                        display_text: 'Copy Your Code',
                                        id: 'copy_pair_code',
                                        copy_code: code
                                    })
                                }
                            ]
                        })
                    })
                }
            }
        }, { quoted: msg, userJid: sock.user.id });

        await sock.relayMessage(jid, interactiveMsg.message, {
            messageId: interactiveMsg.key.id,
            additionalNodes: [
                {
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: { type: 'native_flow', v: '1' },
                            content: [
                                { tag: 'native_flow', attrs: { name: 'mixed', v: '9' } }
                            ]
                        }
                    ]
                }
            ]
        });
        return interactiveMsg;
    } catch (e) {
        return await reply(sock, jid, msg, box('ADD PAIR', 'Number: +' + number + '\nPairing Code: ' + code + '\n'));
    }
};

const sendNativeButtons = async (sock, jid, msg, { text, footer, title, buttons }) => {
    try {
        const { generateWAMessageFromContent, proto } = await getBaileys();
        const interactiveMsg = await generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage: proto.Message.InteractiveMessage.create({
                        contextInfo: {
                            forwardingScore: 999,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterName: effectiveChannelName(sock),
                                newsletterJid: global.chid,
                            }
                        },
                        header: title ? proto.Message.InteractiveMessage.Header.create({
                            title,
                            hasMediaAttachment: false
                        }) : undefined,
                        body: proto.Message.InteractiveMessage.Body.create({
                            text: text || ''
                        }),
                        footer: proto.Message.InteractiveMessage.Footer.create({
                            text: footer || ''
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                            buttons
                        })
                    })
                }
            }
        }, { quoted: msg || undefined, userJid: sock.user.id });

        await sock.relayMessage(jid, interactiveMsg.message, {
            messageId: interactiveMsg.key.id,
            additionalNodes: [
                {
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: { type: 'native_flow', v: '1' },
                            content: [
                                { tag: 'native_flow', attrs: { name: 'mixed', v: '9' } }
                            ]
                        }
                    ]
                }
            ]
        });
        return interactiveMsg;
    } catch (e) {
        console.log('[sendNativeButtons] failed:', e && e.message ? e.message : e);
        return null;
    }
};

const nfQuickReply = (displayText, id) => ({
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({ display_text: displayText, id })
});

const nfUrl = (displayText, url) => ({
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({ display_text: displayText, url })
});

const nfCopy = (displayText, id, copyCode) => ({
    name: 'cta_copy',
    buttonParamsJson: JSON.stringify({ display_text: displayText, id, copy_code: copyCode })
});

const nfList = (displayText, sections) => ({
    name: 'single_select',
    buttonParamsJson: JSON.stringify({
        title: displayText,
        sections
    })
});

const nfCall = (displayText, phoneNumber) => ({
    name: 'cta_call',
    buttonParamsJson: JSON.stringify({
        display_text: displayText,
        id: 'call_' + phoneNumber,
        phone_number: phoneNumber
    })
});

function normalizeJidNumber(jid) {
    if (!jid) return '';
    return jid.split('@')[0].split(':')[0];
}

function isLidJid(jid) {
    return !!jid && jid.endsWith('@lid');
}

function resolveIdentityNumber(jidOrNumber) {
    if (!jidOrNumber) return '';
    if (isLidJid(jidOrNumber)) {
        const contact = resolveContact(jidOrNumber);
        if (contact && contact.number) return contact.number;
    }
    return normalizeJidNumber(jidOrNumber);
}

function isSuperOwner(jidOrNumber) {
    const number = resolveIdentityNumber(jidOrNumber);
    if (!number) return false;
    return global.ownerNumbers.includes(number)
        || number === global.mainBotNumber;
}

function isAddedOwner(jidOrNumber) {
    const number = resolveIdentityNumber(jidOrNumber);
    if (!number) return false;
    return global.db.owners.some(e => e.number === number);
}

function isOwner(jidOrNumber) {
    return isSuperOwner(jidOrNumber) || isAddedOwner(jidOrNumber);
}

function isPremium(jidOrNumber) {
    const number = resolveIdentityNumber(jidOrNumber);
    if (!number) return false;
    return global.db.premium.some(e => e.number === number) || isSuperOwner(jidOrNumber);
}

function findOwnerEntry(number) {
    return global.db.owners.find(e => e.number === number);
}

function addOwnerEntry(number, addedBy) {
    if (findOwnerEntry(number)) return { error: 'exists' };
    global.db.owners.push({ number, addedBy: addedBy || null });
    global.saveOwners();
    return { success: true };
}

function removeOwnerEntry(number, callerNumber, bypassScope) {
    const entry = findOwnerEntry(number);
    if (!entry) return { error: 'not_found' };
    if (!bypassScope && entry.addedBy !== callerNumber) return { error: 'forbidden' };
    global.db.owners = global.db.owners.filter(e => e.number !== number);
    global.saveOwners();
    return { success: true };
}

function listOwnerEntries(callerNumber, bypassScope) {
    return bypassScope
        ? global.db.owners.slice()
        : global.db.owners.filter(e => e.addedBy === callerNumber);
}

function clearOwnerEntries(callerNumber, bypassScope) {
    const before = global.db.owners.length;
    global.db.owners = bypassScope
        ? []
        : global.db.owners.filter(e => e.addedBy !== callerNumber);
    global.saveOwners();
    return before - global.db.owners.length;
}

function findPremiumEntry(number) {
    return global.db.premium.find(e => e.number === number);
}

function addPremiumEntry(number, addedBy) {
    if (findPremiumEntry(number)) return { error: 'exists' };
    global.db.premium.push({ number, addedBy: addedBy || null });
    global.savePremium();
    return { success: true };
}

function removePremiumEntry(number, callerNumber, bypassScope) {
    const entry = findPremiumEntry(number);
    if (!entry) return { error: 'not_found' };
    if (!bypassScope && entry.addedBy !== callerNumber) return { error: 'forbidden' };
    global.db.premium = global.db.premium.filter(e => e.number !== number);
    global.savePremium();
    return { success: true };
}

function listPremiumEntries(callerNumber, bypassScope) {
    return bypassScope
        ? global.db.premium.slice()
        : global.db.premium.filter(e => e.addedBy === callerNumber);
}

function clearPremiumEntries(callerNumber, bypassScope) {
    const before = global.db.premium.length;
    global.db.premium = bypassScope
        ? []
        : global.db.premium.filter(e => e.addedBy !== callerNumber);
    global.savePremium();
    return before - global.db.premium.length;
}

const contactsFile = path.join(__dirname, 'data', 'contacts.json');

function loadContacts() {
    try {
        if (!fs.existsSync(contactsFile)) return { byLid: {}, byNumber: {} };
        return JSON.parse(fs.readFileSync(contactsFile, 'utf-8'));
    } catch (e) {
        return { byLid: {}, byNumber: {} };
    }
}

function resolveContact(idOrNumber) {
    const key = normalizeJidNumber(idOrNumber);
    const data = loadContacts();
    return data.byLid[key] || data.byNumber[key] || null;
}

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 MB';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
        value /= 1024;
        i++;
    }
    return value.toFixed(2) + ' ' + units[i];
}

function detectPlatformName() {
    if (process.env.TERMUX_VERSION || (process.env.PREFIX && process.env.PREFIX.includes('com.termux'))) return 'Termux';
    if (process.env.DYNO) return 'Heroku';
    if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) return 'Railway';
    if (process.env.RENDER) return 'Render';
    if (process.env.KOYEB_APP_ID) return 'Koyeb';
    if (process.env.REPL_ID || process.env.REPL_SLUG) return 'Replit';
    if (process.env.CODESPACES) return 'GitHub Codespaces';
    if (process.env.GLITCH_PROJECT_ID) return 'Glitch';
    if (process.env.PANEL || process.env.PTERODACTYL_SERVER_UUID || process.env.P_SERVER_UUID) return 'Pterodactyl Panel';
    if (process.env.FLY_APP_NAME) return 'Fly.io';
    if (os.platform() === 'linux') return 'VPS / Linux Server';
    if (os.platform() === 'win32') return 'Windows Server';
    if (os.platform() === 'darwin') return 'macOS';
    return os.platform();
}

function getCpuSnapshot() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    cpus.forEach(cpu => {
        for (const type in cpu.times) total += cpu.times[type];
        idle += cpu.times.idle;
    });
    return { idle, total, cores: cpus.length };
}

function getCpuUsagePercent(sampleMs = 400) {
    return new Promise((resolve) => {
        const start = getCpuSnapshot();
        setTimeout(() => {
            const end = getCpuSnapshot();
            const idleDiff = end.idle - start.idle;
            const totalDiff = end.total - start.total;
            const usage = totalDiff > 0 ? (100 - (100 * idleDiff / totalDiff)) : 0;
            resolve({ usagePercent: Math.min(100, Math.max(0, usage)), cores: end.cores });
        }, sampleMs);
    });
}

function getDiskStats() {
    const targetPath = process.platform === 'win32' ? 'C:' : '/';
    try {
        if (typeof fs.statfsSync === 'function') {
            const stats = fs.statfsSync(targetPath);
            const total = stats.blocks * stats.bsize;
            const free = stats.bfree * stats.bsize;
            return { total, used: total - free, free };
        }
    } catch (e) {}
    try {
        const output = execSync('df -k ' + targetPath).toString();
        const lines = output.trim().split('\n');
        const parts = lines[lines.length - 1].trim().split(/\s+/);
        const totalKb = parseInt(parts[1], 10);
        const usedKb = parseInt(parts[2], 10);
        const availKb = parseInt(parts[3], 10);
        if (!isNaN(totalKb) && !isNaN(usedKb) && !isNaN(availKb)) {
            return { total: totalKb * 1024, used: usedKb * 1024, free: availKb * 1024 };
        }
    } catch (e) {}
    return null;
}

async function getDeployStats() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const cpu = await getCpuUsagePercent();
    const disk = getDiskStats();

    return {
        platform: detectPlatformName(),
        ram: {
            total: formatBytes(totalMem),
            used: formatBytes(usedMem),
            free: formatBytes(freeMem)
        },
        cpu: {
            total: cpu.cores + ' Core(s)',
            used: cpu.usagePercent.toFixed(1) + '%',
            free: (100 - cpu.usagePercent).toFixed(1) + '%'
        },
        disk: disk ? {
            total: formatBytes(disk.total),
            used: formatBytes(disk.used),
            free: formatBytes(disk.free)
        } : {
            total: 'N/A',
            used: 'N/A',
            free: 'N/A'
        }
    };
}

function cleanPhoneNumber(input) {
    let cleaned = String(input).replace(/[^0-9]/g, '');
    if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);
    return cleaned;
}

function isSocketWsOpen(s) {
    try {
        if (s.ws && typeof s.ws.isOpen === 'boolean') return s.ws.isOpen;
        if (s.ws && s.ws.socket && typeof s.ws.socket.readyState === 'number') {
            return s.ws.socket.readyState === 1;
        }
    } catch (e) {}
    return false;
}

async function waitForSocketOpen(s, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (isSocketWsOpen(s)) return true;
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    return isSocketWsOpen(s);
}

function countFeatures() {
    try {
        const menustyleSrc = fs.readFileSync(path.join(__dirname, 'commands', 'control', 'menustyle.js'), 'utf-8');
        const sectionsMatch = menustyleSrc.match(/const MENU_SECTIONS = (\[[\s\S]*?\n\]);/);
        if (!sectionsMatch) return 0;
        const sections = new Function('return ' + sectionsMatch[1])();
        const unique = new Set();
        sections.forEach(section => {
            if (section.items) {
                section.items.forEach(item => unique.add(item.split(' ')[0].toLowerCase()));
            }
            if (section.groups) {
                section.groups.forEach(group => {
                    group.items.forEach(item => unique.add(item.split(' ')[0].toLowerCase()));
                });
            }
        });
        return unique.size;
    } catch (e) {
        return 0;
    }
}

const controlDataDir = path.join(__dirname, 'data');
if (!fs.existsSync(controlDataDir)) fs.mkdirSync(controlDataDir, { recursive: true });
const commentsFile = path.join(controlDataDir, 'comments.json');
const MAX_STORED_COMMENTS = 200;

function loadComments() {
    try {
        if (!fs.existsSync(commentsFile)) {
            fs.writeFileSync(commentsFile, JSON.stringify([], null, 2));
            return [];
        }
        return JSON.parse(fs.readFileSync(commentsFile, 'utf-8'));
    } catch (e) {
        return [];
    }
}

function saveComments(list) {
    fs.writeFileSync(commentsFile, JSON.stringify(list, null, 2));
}

function addComment(name, message) {
    const cleanName = String(name || 'Guest').trim().slice(0, 30) || 'Guest';
    const cleanMessage = String(message || '').trim().slice(0, 250);
    if (!cleanMessage) return { error: 'Message cannot be empty.' };
    const list = loadComments();
    const entry = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 8), name: cleanName, message: cleanMessage, time: Date.now() };
    list.push(entry);
    while (list.length > MAX_STORED_COMMENTS) list.shift();
    saveComments(list);
    return { entry };
}

async function handleMessagesUpsert(sock, m, isMainSession) {
    try {
        if (m.type !== 'notify' && m.type !== 'append') return;
        const msg = m.messages[0];
        if (!msg || !msg.message) return;

        if (m.type === 'append') {
        }

        const { handleAutoseenWatch } = require('./commands/personal/autoseen');
        await handleAutoseenWatch(sock, msg);

        const { handleAutoreplyWatch } = require('./commands/personal/autoreply');
        await handleAutoreplyWatch(sock, msg);

        const { handleautostatusviewWatch } = require('./commands/personal/autostatusview');
        await handleautostatusviewWatch(sock, msg);
        
        const { handleAutostatuslikeWatch } = require('./commands/personal/autostatuslike');
        await handleAutostatuslikeWatch(sock, msg);

        const { handleAutostatusdownloadWatch } = require('./commands/personal/autostatusdownload');
        await handleAutostatusdownloadWatch(sock, msg);

        const { handleAlwaysonlineWatch } = require('./commands/personal/alwaysonline');
        await handleAlwaysonlineWatch(sock, msg);

        const { handleAutoblockunknownWatch } = require('./commands/personal/autoblockunknown');
        await handleAutoblockunknownWatch(sock, msg);

        const { handleAutotypingWatch } = require('./commands/personal/autotyping');
        await handleAutotypingWatch(sock, msg);

        const { handleAutorecordingWatch } = require('./commands/personal/autorecording');
        await handleAutorecordingWatch(sock, msg);

        const { handleAutoreactWatch } = require('./commands/personal/autoreact');
        await handleAutoreactWatch(sock, msg);

        const { handleAutoviewonceWatch } = require('./commands/personal/autoviewonce');
        await handleAutoviewonceWatch(sock, msg);

        const { handleAutoarchiveWatch } = require('./commands/personal/autoarchive');
        await handleAutoarchiveWatch(sock, msg);

        const { handleAutomuteWatch } = require('./commands/personal/automute');
        await handleAutomuteWatch(sock, msg);

        const { handleAutogreetWatch } = require('./commands/personal/autogreet');
        await handleAutogreetWatch(sock, msg);

        const { handleMessage } = require('./menu');
        await handleMessage(sock, msg, isMainSession);
    } catch (e) {
        console.log('HANDLE MESSAGE ERROR:', e);
    }
}

function attachSessionHandlers(sock, isMainSession) {
    const { attachAutoblockunknownContacts } = require('./commands/personal/autoblockunknown');
    attachAutoblockunknownContacts(sock);

    const { attachAutoblockunknowncalls } = require('./commands/personal/autoblockunknowncalls');
    attachAutoblockunknowncalls(sock);

    const { attachAnticall } = require('./commands/personal/anticall');
    attachAnticall(sock);

    const { attachAutosavedeleted } = require('./commands/personal/autosavedeleted');
    attachAutosavedeleted(sock);

    const { attachAutoblockgroup } = require('./commands/personal/autoblockgroup');
    attachAutoblockgroup(sock);

    const { attachFreezelastseenHandlers } = require('./commands/personal/freezelastseen');
    attachFreezelastseenHandlers(sock);

    sock.ev.on('messages.upsert', (m) => handleMessagesUpsert(sock, m, isMainSession));
}

const COUNTRY_CODES = {
    '1': ['US', 'USA/Canada'], '7': ['RU', 'Russia/Kazakhstan'],
    '20': ['EG', 'Egypt'], '27': ['ZA', 'South Africa'], '30': ['GR', 'Greece'],
    '31': ['NL', 'Netherlands'], '32': ['BE', 'Belgium'], '33': ['FR', 'France'],
    '34': ['ES', 'Spain'], '36': ['HU', 'Hungary'], '39': ['IT', 'Italy'],
    '40': ['RO', 'Romania'], '41': ['CH', 'Switzerland'], '43': ['AT', 'Austria'],
    '44': ['GB', 'United Kingdom'], '45': ['DK', 'Denmark'], '46': ['SE', 'Sweden'],
    '47': ['NO', 'Norway'], '48': ['PL', 'Poland'], '49': ['DE', 'Germany'],
    '51': ['PE', 'Peru'], '52': ['MX', 'Mexico'], '53': ['CU', 'Cuba'],
    '54': ['AR', 'Argentina'], '55': ['BR', 'Brazil'], '56': ['CL', 'Chile'],
    '57': ['CO', 'Colombia'], '58': ['VE', 'Venezuela'], '60': ['MY', 'Malaysia'],
    '61': ['AU', 'Australia'], '62': ['ID', 'Indonesia'], '63': ['PH', 'Philippines'],
    '64': ['NZ', 'New Zealand'], '65': ['SG', 'Singapore'], '66': ['TH', 'Thailand'],
    '81': ['JP', 'Japan'], '82': ['KR', 'South Korea'], '84': ['VN', 'Vietnam'],
    '86': ['CN', 'China'], '90': ['TR', 'Turkey'], '91': ['IN', 'India'],
    '92': ['PK', 'Pakistan'], '93': ['AF', 'Afghanistan'], '94': ['LK', 'Sri Lanka'],
    '95': ['MM', 'Myanmar'], '98': ['IR', 'Iran'], '211': ['SS', 'South Sudan'],
    '212': ['MA', 'Morocco'], '213': ['DZ', 'Algeria'], '216': ['TN', 'Tunisia'],
    '218': ['LY', 'Libya'], '220': ['GM', 'Gambia'], '221': ['SN', 'Senegal'],
    '225': ['CI', 'Ivory Coast'], '233': ['GH', 'Ghana'], '234': ['NG', 'Nigeria'],
    '237': ['CM', 'Cameroon'], '249': ['SD', 'Sudan'], '251': ['ET', 'Ethiopia'],
    '254': ['KE', 'Kenya'], '255': ['TZ', 'Tanzania'], '256': ['UG', 'Uganda'],
    '260': ['ZM', 'Zambia'], '263': ['ZW', 'Zimbabwe'], '351': ['PT', 'Portugal'],
    '352': ['LU', 'Luxembourg'], '353': ['IE', 'Ireland'], '354': ['IS', 'Iceland'],
    '355': ['AL', 'Albania'], '356': ['MT', 'Malta'], '357': ['CY', 'Cyprus'],
    '358': ['FI', 'Finland'], '359': ['BG', 'Bulgaria'], '370': ['LT', 'Lithuania'],
    '371': ['LV', 'Latvia'], '372': ['EE', 'Estonia'], '373': ['MD', 'Moldova'],
    '374': ['AM', 'Armenia'], '375': ['BY', 'Belarus'], '376': ['AD', 'Andorra'],
    '378': ['SM', 'San Marino'], '380': ['UA', 'Ukraine'], '381': ['RS', 'Serbia'],
    '382': ['ME', 'Montenegro'], '383': ['XK', 'Kosovo'], '385': ['HR', 'Croatia'],
    '386': ['SI', 'Slovenia'], '387': ['BA', 'Bosnia and Herzegovina'],
    '389': ['MK', 'North Macedonia'], '420': ['CZ', 'Czech Republic'],
    '421': ['SK', 'Slovakia'], '423': ['LI', 'Liechtenstein'], '502': ['GT', 'Guatemala'],
    '503': ['SV', 'El Salvador'], '504': ['HN', 'Honduras'], '505': ['NI', 'Nicaragua'],
    '506': ['CR', 'Costa Rica'], '507': ['PA', 'Panama'], '509': ['HT', 'Haiti'],
    '591': ['BO', 'Bolivia'], '593': ['EC', 'Ecuador'], '595': ['PY', 'Paraguay'],
    '598': ['UY', 'Uruguay'], '850': ['KP', 'North Korea'],
    '852': ['HK', 'Hong Kong'], '853': ['MO', 'Macau'], '855': ['KH', 'Cambodia'],
    '856': ['LA', 'Laos'], '880': ['BD', 'Bangladesh'], '886': ['TW', 'Taiwan'],
    '960': ['MV', 'Maldives'], '961': ['LB', 'Lebanon'], '962': ['JO', 'Jordan'],
    '963': ['SY', 'Syria'], '964': ['IQ', 'Iraq'], '965': ['KW', 'Kuwait'],
    '966': ['SA', 'Saudi Arabia'], '967': ['YE', 'Yemen'], '968': ['OM', 'Oman'],
    '970': ['PS', 'Palestine'], '971': ['AE', 'United Arab Emirates'],
    '972': ['IL', 'Israel'], '973': ['BH', 'Bahrain'], '974': ['QA', 'Qatar'],
    '975': ['BT', 'Bhutan'], '976': ['MN', 'Mongolia'], '977': ['NP', 'Nepal'],
    '992': ['TJ', 'Tajikistan'], '993': ['TM', 'Turkmenistan'], '994': ['AZ', 'Azerbaijan'],
    '995': ['GE', 'Georgia'], '996': ['KG', 'Kyrgyzstan'], '998': ['UZ', 'Uzbekistan']
};

const SORTED_CODES = Object.keys(COUNTRY_CODES).sort((a, b) => b.length - a.length);

function isoToFlag(iso2) {
    try {
        return String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 127397 + c.charCodeAt(0)));
    } catch (e) {
        return '🏳️';
    }
}

function detectCountry(number) {
    const cleaned = cleanPhoneNumber(number);
    for (const code of SORTED_CODES) {
        if (cleaned.startsWith(code)) {
            const [iso2, name] = COUNTRY_CODES[code];
            return { iso2, name, flag: isoToFlag(iso2) };
        }
    }
    return { iso2: '', name: 'Unknown', flag: '🏳️' };
}

const SOCIAL_LINKS = {
    youtube: 'https://www.youtube.com/lwazi',
    whatsappGroup: 'https://chat.whatsapp.com/C1QDOKbgxfV3pgmzHWqfmr',
    whatsappChannel: 'https://whatsapp.com/channel/0029VbDK7drI1rcoEQNE1K3S',
    whatsappNumber: 'https://wa.me/27736324314',
    telegram: 'https://t.me/lwazi'
};

function getSocialLinksHtml() {
    let items = '';
    if (SOCIAL_LINKS.youtube) {
        items += '<a class="soc-item" href="' + SOCIAL_LINKS.youtube + '" target="_blank" rel="noopener">'
            + '<div class="soc yt"><svg viewBox="0 0 24 24"><path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.7 3.5 12 3.5 12 3.5s-7.7 0-9.5.6c-1 .3-1.7 1.1-2 2.1C0 8 0 12 0 12s0 4 .5 5.8c.3 1 1 1.8 2 2.1 1.8.6 9.5.6 9.5.6s7.7 0 9.5-.6c1-.3 1.7-1.1 2-2.1.5-1.8.5-5.8.5-5.8s0-4-.5-5.8zM9.6 15.5V8.5l6.4 3.5-6.4 3.5z"/></svg></div>'
            + '<span class="soc-label">YouTube</span></a>';
    }
    if (SOCIAL_LINKS.whatsappChannel) {
        items += '<a class="soc-item" href="' + SOCIAL_LINKS.whatsappChannel + '" target="_blank" rel="noopener">'
            + '<div class="soc wc"><svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.7 1.5 5.3L2 22l4.8-1.5C8.3 21.5 10.1 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2zm5.4 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.6-.6-2.9-1.3-4.8-4.2-4.9-4.4-.1-.2-1.2-1.6-1.2-3 0-1.4.7-2.1 1-2.4.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.8.8 1.9.1.2.1.3 0 .5-.1.2-.1.3-.3.5-.1.2-.3.4-.4.5-.1.1-.3.3-.1.6.2.3.9 1.4 1.9 2.3 1.3 1.1 2.4 1.5 2.7 1.6.3.1.5.1.7-.1.2-.2.7-.9 1-1.2.2-.3.5-.2.8-.1.3.1 1.8.9 2.1 1 .3.1.5.2.6.3.1.2.1.9-.1 1.6z"/></svg></div>'
            + '<span class="soc-label">Channel</span></a>';
    }
    if (SOCIAL_LINKS.whatsappGroup) {
        items += '<a class="soc-item" href="' + SOCIAL_LINKS.whatsappGroup + '" target="_blank" rel="noopener">'
            + '<div class="soc wg"><svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.7 1.5 5.3L2 22l4.8-1.5C8.3 21.5 10.1 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2zm3.2 14.5c-4 0-6.5-3.3-6.5-5.8 0-1.1.7-1.9 1.3-2.3.2-.1.5-.1.6.1l.9 1.6c.1.2.1.4 0 .5l-.5.7c-.1.2-.1.3 0 .5.3.6 1.5 2 2.9 2.6.2.1.3.1.5-.1l.6-.6c.2-.2.3-.2.5-.1l1.6.8c.2.1.2.4.1.6-.3.5-1 1.5-2 1.5z"/></svg></div>'
            + '<span class="soc-label">Group</span></a>';
    }
    if (SOCIAL_LINKS.whatsappNumber) {
        items += '<a class="soc-item" href="' + SOCIAL_LINKS.whatsappNumber + '" target="_blank" rel="noopener">'
            + '<div class="soc wn"><svg viewBox="0 0 24 24"><path d="M17 2H7C4.2 2 2 4.2 2 7v10c0 2.8 2.2 5 5 5h10c2.8 0 5-2.2 5-5V7c0-2.8-2.2-5-5-5zm-5 15.5c-1 0-1.9-.3-2.7-.7l-3 .8.8-2.9c-.5-.9-.8-1.8-.8-2.9C6.3 8.6 8.9 6 12 6s5.7 2.6 5.7 5.8-2.6 5.7-5.7 5.7z"/></svg></div>'
            + '<span class="soc-label">Connect</span></a>';
    }
    if (SOCIAL_LINKS.telegram) {
        items += '<a class="soc-item" href="' + SOCIAL_LINKS.telegram + '" target="_blank" rel="noopener">'
            + '<div class="soc tg"><svg viewBox="0 0 24 24"><path d="M22 3 2.5 10.8c-1.3.5-1.3 1.3-.2 1.6l5 1.6 1.9 6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.2-2.1 4.6 3.4c.8.5 1.4.2 1.6-.8L23.9 4.5c.3-1.2-.5-1.8-1.9-1.5zM7.7 13.6l9.4-6c.4-.3.8-.1.5.2l-7.6 6.9-.3 3.2-1.4-4.3z"/></svg></div>'
            + '<span class="soc-label">Telegram</span></a>';
    }
    return items;
}

function getPageHtml() {
    return '<!DOCTYPE html>'
        + '<html lang="en"><head><meta charset="UTF-8">'
        + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        + '<title>' + global.botname + ' Pairing</title>'
        + '<style>'
        + ':root{--bg1:#0b1220;--bg2:#111a2e;--card:rgba(22,28,44,0.72);--border:rgba(255,255,255,0.08);--text:#f0f2f7;--sub:#94a0b8;--accent:#25D366;--accent2:#4f7cff;--input:rgba(255,255,255,0.05);--font:"Segoe UI",Arial,sans-serif;}'
        + '[data-theme="light"]{--bg1:#eef2fb;--bg2:#dde6f7;--card:rgba(255,255,255,0.75);--border:rgba(0,0,0,0.07);--text:#101828;--sub:#5a6478;--accent:#1fa855;--accent2:#4f7cff;--input:rgba(0,0,0,0.04);--font:"Segoe UI",Arial,sans-serif;}'
        + '[data-theme="neon"]{--bg1:#050014;--bg2:#0e0326;--card:rgba(10,4,32,0.68);--border:rgba(0,255,224,0.28);--text:#eafcff;--sub:#8fa3d6;--accent:#00ffe0;--accent2:#ff00c8;--input:rgba(0,255,224,0.07);--font:"Orbitron","Segoe UI",sans-serif;}'
        + '[data-theme="royal"]{--bg1:#160c04;--bg2:#2a1706;--card:rgba(38,22,6,0.72);--border:rgba(212,175,55,0.35);--text:#fbf1da;--sub:#c9a86a;--accent:#e8c158;--accent2:#8b5cf6;--input:rgba(212,175,55,0.08);--font:"Playfair Display",Georgia,serif;}'
        + '[data-theme="aurora"]{--bg1:#001417;--bg2:#012a30;--card:rgba(0,28,36,0.68);--border:rgba(64,224,208,0.3);--text:#e2fffa;--sub:#77c9c0;--accent:#40e0d0;--accent2:#7c6cf0;--input:rgba(64,224,208,0.07);--font:"Segoe UI",Arial,sans-serif;}'
        + '*{box-sizing:border-box;}'
        + 'body{font-family:var(--font,"Segoe UI",Arial,sans-serif);color:var(--text);display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;position:relative;overflow-x:hidden;'
        + 'background:linear-gradient(160deg,var(--bg1),var(--bg2));transition:background .4s,color .4s,font-family .2s;}'
        + '.blob{position:fixed;border-radius:50%;filter:blur(80px);opacity:.35;z-index:0;pointer-events:none;transition:background .4s;}'
        + '.blob1{width:320px;height:320px;background:var(--accent);top:-80px;left:-80px;}'
        + '.blob2{width:280px;height:280px;background:var(--accent2);bottom:-60px;right:-60px;}'
        + '.blob3{width:220px;height:220px;background:var(--accent2);top:40%;right:10%;opacity:.25;}'
        + '.themeBtn{position:fixed;top:18px;right:18px;width:42px;height:42px;border-radius:50%;border:1px solid var(--border);background:var(--card);backdrop-filter:blur(10px);color:var(--text);font-size:18px;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;}'
        + '.leftThemeBar{position:fixed;top:18px;left:18px;display:flex;gap:8px;z-index:10;}'
        + '.styleBtn{width:42px;height:42px;border-radius:50%;border:1px solid var(--border);background:var(--card);backdrop-filter:blur(10px);color:var(--text);font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s,box-shadow .2s,border-color .2s;}'
        + '.styleBtn:active{transform:scale(.92);}'
        + '.styleBtn.active{border-color:var(--accent);box-shadow:0 0 14px var(--accent);}'
        + '.card{background:var(--card);backdrop-filter:blur(16px);border:1px solid var(--border);padding:32px 28px;border-radius:18px;width:100%;max-width:400px;text-align:center;position:relative;z-index:1;box-shadow:0 10px 40px rgba(0,0,0,0.25);}'
        + 'h1{font-size:22px;margin-bottom:4px;letter-spacing:.3px;}'
        + 'p.sub{color:var(--sub);margin-top:0;font-size:13px;}'
        + 'input{width:100%;padding:13px;margin-top:16px;border-radius:10px;border:1px solid var(--border);background:var(--input);color:var(--text);box-sizing:border-box;font-size:15px;outline:none;}'
        + 'button{width:100%;padding:13px;margin-top:14px;border-radius:10px;border:none;background:var(--accent);color:#04140a;font-weight:700;font-size:15px;cursor:pointer;transition:transform .15s;}'
        + 'button:active{transform:scale(.98);}'
        + '.code{margin-top:20px;font-size:30px;letter-spacing:5px;font-weight:800;color:var(--accent);}'
        + '.status{margin-top:16px;font-size:13px;color:var(--sub);}'
        + '.error{color:#ff5f5f;margin-top:10px;font-size:13px;}'
        + '.connected{color:var(--accent);margin-top:10px;font-size:14px;font-weight:bold;}'
        + '.divider{margin:24px 0 16px;border-top:1px solid var(--border);}'
        + '.social{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;}'
        + '.soc-item{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px;border-radius:12px;border:1px solid var(--border);background:var(--input);text-decoration:none;transition:transform .15s;min-width:66px;}'
        + '.soc-item:hover{transform:translateY(-3px);}'
        + '.soc{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.04);transition:background .15s;}'
        + '.soc svg{width:19px;height:19px;fill:var(--text);}'
        + '.soc-item:hover .soc.yt{background:#FF0000;}'
        + '.soc-item:hover .soc.wc,.soc-item:hover .soc.wg,.soc-item:hover .soc.wn{background:#25D366;}'
        + '.soc-item:hover .soc.tg{background:#229ED9;}'
        + '.soc-item:hover .soc svg{fill:#fff;}'
        + '.soc-label{font-size:11px;color:var(--sub);font-weight:600;}'
        + '.footer{margin-top:18px;font-size:11px;color:var(--sub);}'
        + '.banner{position:relative;z-index:1;text-align:center;font-size:19px;font-weight:800;margin-bottom:18px;background:linear-gradient(90deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:1px;}'
        + '.wrap{display:flex;flex-direction:column;align-items:center;position:relative;z-index:1;}'
        + '.stats{margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:10px;}'
        + '.stat{background:var(--input);border:1px solid var(--border);border-radius:10px;padding:10px 8px;}'
        + '.stat .val{font-size:16px;font-weight:800;color:var(--accent);}'
        + '.stat .lbl{font-size:11px;color:var(--sub);margin-top:2px;}'
        + '.stat-groups{margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:10px;}'
        + '.stat-group{background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;}'
        + '.stat-group-title{font-size:12px;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:.5px;text-align:center;margin-bottom:2px;}'
        + '.owner{grid-column:1/3;}'
        + '.countries{margin-top:16px;text-align:left;}'
        + '.countries h3{font-size:12px;color:var(--sub);margin:0 0 8px;text-transform:uppercase;letter-spacing:.5px;}'
        + '.crow{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);}'
        + '.crow:last-child{border-bottom:none;}'
        + '.crow .flag{font-size:18px;}'
        + '.crow .name{flex:1;font-size:13px;}'
        + '.crow .cnt{font-size:12px;color:var(--sub);}'
        + '.crow .bar{width:100%;height:5px;background:var(--input);border-radius:3px;margin-top:4px;overflow:hidden;}'
        + '.crow .bar-fill{height:100%;background:linear-gradient(90deg,#25D366,#4f7cff);}'
        + '.crow .top{display:flex;justify-content:space-between;align-items:center;}'
        + '.crow .pct{font-size:13px;font-weight:800;color:var(--accent);}'
        + '.announce{width:100%;max-width:400px;background:var(--card);backdrop-filter:blur(16px);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:14px;position:relative;z-index:1;box-shadow:0 6px 24px rgba(0,0,0,0.2);text-align:left;}'
        + '.announce .live{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;}'
        + '.dot{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:pulse 1.4s infinite;}'
        + '@keyframes pulse{0%{opacity:1;}50%{opacity:.3;}100%{opacity:1;}}'
        + '.announce .txt{font-size:14px;color:var(--text);white-space:pre-wrap;}'
        + '.comments{margin-top:16px;text-align:left;}'
        + '.comments h3{font-size:12px;color:var(--sub);margin:0 0 8px;text-transform:uppercase;letter-spacing:.5px;}'
        + '.cbox{max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:2px;}'
        + '.cmsg{background:var(--input);border:1px solid var(--border);border-radius:10px;padding:8px 10px;}'
        + '.cmsg .cname{font-size:12px;font-weight:700;color:var(--accent);}'
        + '.cmsg .ctext{font-size:13px;color:var(--text);margin-top:2px;word-break:break-word;}'
        + '.cmsg .ctime{font-size:10px;color:var(--sub);margin-top:3px;}'
        + '.cform{display:flex;flex-direction:column;gap:8px;margin-top:10px;}'
        + '.cform input,.cform textarea{width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--input);color:var(--text);box-sizing:border-box;font-size:13px;font-family:inherit;outline:none;resize:none;}'
        + '.cform button{margin-top:0;}'
        + '.empty{font-size:12px;color:var(--sub);text-align:center;padding:10px 0;}'
        + '.clockCard{width:100%;max-width:400px;background:var(--card);backdrop-filter:blur(16px);border:1px solid var(--border);border-radius:18px;padding:22px 20px;margin-bottom:14px;position:relative;z-index:1;box-shadow:0 6px 24px rgba(0,0,0,0.2);display:flex;flex-direction:column;align-items:center;gap:16px;transition:background .4s,border-color .4s;}'
        + '.analogClock{width:150px;height:150px;border-radius:50%;background:var(--input);border:3px solid var(--accent);position:relative;box-shadow:inset 0 0 22px rgba(0,0,0,.25),0 0 18px color-mix(in srgb,var(--accent) 45%,transparent);transition:border-color .4s,box-shadow .4s;}'
        + '.tickWrap{position:absolute;inset:0;}'
        + '.tick{position:absolute;top:6px;left:50%;width:2px;height:9px;background:var(--sub);transform:translateX(-50%);border-radius:2px;}'
        + '.tick.major{height:13px;width:3px;background:var(--accent);}'
        + '.handWrap{position:absolute;inset:0;}'
        + '.hand{position:absolute;left:50%;top:50%;border-radius:4px;transform:translateX(-50%);transform-origin:50% 100%;}'
        + '.hand.hour{width:5px;height:38px;margin-top:-38px;background:var(--text);}'
        + '.hand.minute{width:3.5px;height:54px;margin-top:-54px;background:var(--text);}'
        + '.hand.second{width:2px;height:60px;margin-top:-60px;background:var(--accent2,var(--accent));}'
        + '.centerDot{position:absolute;width:11px;height:11px;background:var(--accent);border-radius:50%;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5;box-shadow:0 0 8px var(--accent);}'
        + '.digitalTime{font-size:21px;font-weight:800;color:var(--accent);letter-spacing:1.5px;}'
        + '</style></head><body data-theme="dark">'
        + '<div class="blob blob1"></div><div class="blob blob2"></div><div class="blob blob3"></div>'
        + '<button class="themeBtn" id="themeBtn" onclick="toggleTheme()">🌙</button>'
        + '<div class="leftThemeBar">'
        + '<button class="styleBtn" id="styleBtn-neon" title="Neon" onclick="applyTheme(\'neon\')">⚡</button>'
        + '<button class="styleBtn" id="styleBtn-royal" title="Royal" onclick="applyTheme(\'royal\')">👑</button>'
        + '<button class="styleBtn" id="styleBtn-aurora" title="Aurora" onclick="applyTheme(\'aurora\')">🌌</button>'
        + '</div>'
        + '<div class="wrap">'
        + '<div class="announce" id="announceBox" style="display:none;">'
        + '<div class="live"><span class="dot"></span>LIVE ANNOUNCEMENT</div>'
        + '<div class="txt" id="announceText"></div>'
        + '</div>'
        + '<div class="clockCard">'
        + '<div class="analogClock" id="analogClock">'
        + '<div class="tickWrap" style="transform:rotate(0deg)"><div class="tick major"></div></div>'
        + '<div class="tickWrap" style="transform:rotate(30deg)"><div class="tick"></div></div>'
        + '<div class="tickWrap" style="transform:rotate(60deg)"><div class="tick"></div></div>'
        + '<div class="tickWrap" style="transform:rotate(90deg)"><div class="tick major"></div></div>'
        + '<div class="tickWrap" style="transform:rotate(120deg)"><div class="tick"></div></div>'
        + '<div class="tickWrap" style="transform:rotate(150deg)"><div class="tick"></div></div>'
        + '<div class="tickWrap" style="transform:rotate(180deg)"><div class="tick major"></div></div>'
        + '<div class="tickWrap" style="transform:rotate(210deg)"><div class="tick"></div></div>'
        + '<div class="tickWrap" style="transform:rotate(240deg)"><div class="tick"></div></div>'
        + '<div class="tickWrap" style="transform:rotate(270deg)"><div class="tick major"></div></div>'
        + '<div class="tickWrap" style="transform:rotate(300deg)"><div class="tick"></div></div>'
        + '<div class="tickWrap" style="transform:rotate(330deg)"><div class="tick"></div></div>'
        + '<div class="handWrap" id="hourWrap"><div class="hand hour"></div></div>'
        + '<div class="handWrap" id="minuteWrap"><div class="hand minute"></div></div>'
        + '<div class="handWrap" id="secondWrap"><div class="hand second"></div></div>'
        + '<div class="centerDot"></div>'
        + '</div>'
        + '<div class="digitalTime" id="digitalTime">--:--:--</div>'
        + '</div>'
        + '<div class="card">'
        + '<h1>' + global.botname + '</h1>'
        + '<p class="sub">v' + global.version + ' | Pairing Panel</p>'
        + '<h3 style="margin:14px 0 6px;font-size:13px;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;">Connect Main Bot Number</h3>'
        + '<div id="mainForm">'
        + '<input id="mainSecret" type="password" placeholder="Secret key">'
        + '<input id="mainNumber" type="text" placeholder="923001234567">'
        + '<button onclick="requestMainCode()">Get Main Pairing Code</button>'
        + '</div>'
        + '<div id="mainResult"></div>'
        + '<div class="status" id="mainStatus">This links the bot\'s own primary number.</div>'
        + '<div class="divider"></div>'
        + '<h3 style="margin:0 0 6px;font-size:13px;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;">Link Your Own Number</h3>'
        + '<div id="form">'
        + '<input id="number" type="text" placeholder="923001234567">'
        + '<button onclick="requestCode()">Get Pairing Code</button>'
        + '</div>'
        + '<div id="result"></div>'
        + '<div class="status" id="status">Enter your number to link your own session.</div>'
        + '<div class="divider"></div>'
        + '<div class="social">' + getSocialLinksHtml() + '</div>'
        + '<div class="divider"></div>'
        + '<div class="stat-groups">'
        + '<div class="stat-group">'
        + '<div class="stat-group-title">Main Pair</div>'
        + '<div class="stat"><div class="val" id="s-main-total">-</div><div class="lbl">Main Total Pair</div></div>'
        + '<div class="stat"><div class="val" id="s-main-online">-</div><div class="lbl">Main Online Pair</div></div>'
        + '<div class="stat"><div class="val" id="s-main-offline">-</div><div class="lbl">Main Offline Pair</div></div>'
        + '</div>'
        + '<div class="stat-group">'
        + '<div class="stat-group-title">Local Pair</div>'
        + '<div class="stat"><div class="val" id="s-total">-</div><div class="lbl">Total Pair</div></div>'
        + '<div class="stat"><div class="val" id="s-online">-</div><div class="lbl">Online Pair</div></div>'
        + '<div class="stat"><div class="val" id="s-offline">-</div><div class="lbl">Offline Pair</div></div>'
        + '</div>'
        + '</div>'
        + '<div class="stats" id="stats">'
        + '<div class="stat"><div class="val" id="s-uptime">-</div><div class="lbl">Run Time</div></div>'
        + '<div class="stat"><div class="val" id="s-features">-</div><div class="lbl">Total Features</div></div>'
        + '<div class="stat owner"><div class="val" id="s-owner">-</div><div class="lbl">Bot Owner</div></div>'
        + '</div>'
        + '<div class="countries" id="countries" style="display:none;">'
        + '<h3>🌍 Users by Country</h3>'
        + '<div id="countryList"></div>'
        + '</div>'
        + '<div class="comments">'
        + '<h3>💬 Live Comments</h3>'
        + '<div class="cbox" id="cbox"><div class="empty">Loading comments...</div></div>'
        + '<div class="cform">'
        + '<input id="cname" type="text" placeholder="Your name" maxlength="30">'
        + '<textarea id="cmsg" rows="2" placeholder="Write a comment..." maxlength="250"></textarea>'
        + '<button onclick="sendComment()">Send Comment</button>'
        + '</div>'
        + '</div>'
        + '<div class="footer">© ' + new Date().getFullYear() + ' ' + global.botname + '</div>'
        + '</div>'
        + '</div>'
        + '<script>'
        + 'const STYLE_IDS=["neon","royal","aurora"];'
        + 'function applyTheme(t){'
        + 'document.body.setAttribute("data-theme",t);'
        + 'document.getElementById("themeBtn").innerText=t==="light"?"☀️":"🌙";'
        + 'STYLE_IDS.forEach(function(id){'
        + 'const btn=document.getElementById("styleBtn-"+id);'
        + 'if(btn)btn.classList.toggle("active",t===id);'
        + '});'
        + 'localStorage.setItem("theme",t);'
        + '}'
        + 'function toggleTheme(){const cur=document.body.getAttribute("data-theme");applyTheme(cur==="dark"?"light":"dark");}'
        + '(function(){const saved=localStorage.getItem("theme")||"dark";applyTheme(saved);})();'
        + 'function formatUptime(sec){const d=Math.floor(sec/86400);const h=Math.floor((sec%86400)/3600);const m=Math.floor((sec%3600)/60);const s=sec%60;let out="";if(d)out+=d+"d ";if(h||d)out+=h+"h ";if(m||h||d)out+=m+"m ";out+=s+"s";return out;}'
        + 'async function loadStats(){'
        + 'try{'
        + 'const res=await fetch("/api/stats");'
        + 'const data=await res.json();'
        + 'document.getElementById("s-total").innerText=data.totalPairs;'
        + 'document.getElementById("s-online").innerText=data.onlinePairs;'
        + 'document.getElementById("s-offline").innerText=data.offlinePairs;'
        + 'document.getElementById("s-main-total").innerText=data.mainTotal;'
        + 'document.getElementById("s-main-online").innerText=data.mainOnline;'
        + 'document.getElementById("s-main-offline").innerText=data.mainOffline;'
        + 'document.getElementById("s-uptime").innerText=formatUptime(data.uptimeSeconds);'
        + 'document.getElementById("s-features").innerText=data.totalFeatures;'
        + 'document.getElementById("s-owner").innerText=data.owner;'
        + 'const cWrap=document.getElementById("countries");'
        + 'const cList=document.getElementById("countryList");'
        + 'if(data.countries&&data.countries.length){'
        + 'cWrap.style.display="block";'
        + 'cList.innerHTML=data.countries.map(function(c){'
        + 'return "<div class=\\"crow\\"><div style=\\"flex:1\\">"'
        + '+"<div class=\\"top\\"><span><span class=\\"flag\\">"+c.flag+"</span> <span class=\\"name\\">"+c.country+"</span></span>"'
        + '+"<span class=\\"pct\\">"+c.percent+"%</span></div>"'
        + '+"<div class=\\"bar\\"><div class=\\"bar-fill\\" style=\\"width:"+c.percent+"%\\"></div></div>"'
        + '+"<div class=\\"cnt\\">"+c.count+" user"+(c.count===1?"":"s")+"</div>"'
        + '+"</div></div>";'
        + '}).join("");'
        + '}else{cWrap.style.display="none";}'
        + '}catch(e){}'
        + '}'
        + 'loadStats();setInterval(loadStats,5000);'
        + 'function updateClock(){'
        + 'const now=new Date();'
        + 'const h=now.getHours()%12;const m=now.getMinutes();const s=now.getSeconds();'
        + 'const hourDeg=(h*30)+(m*0.5);'
        + 'const minDeg=(m*6)+(s*0.1);'
        + 'const secDeg=s*6;'
        + 'document.getElementById("hourWrap").style.transform="rotate("+hourDeg+"deg)";'
        + 'document.getElementById("minuteWrap").style.transform="rotate("+minDeg+"deg)";'
        + 'document.getElementById("secondWrap").style.transform="rotate("+secDeg+"deg)";'
        + 'document.getElementById("digitalTime").innerText=now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true});'
        + '}'
        + 'updateClock();setInterval(updateClock,1000);'
        + 'function escapeHtml(s){const d=document.createElement("div");d.innerText=s;return d.innerHTML;}'
        + 'function timeAgo(ts){const s=Math.floor((Date.now()-ts)/1000);if(s<60)return "just now";const m=Math.floor(s/60);if(m<60)return m+"m ago";const h=Math.floor(m/60);if(h<24)return h+"h ago";return Math.floor(h/24)+"d ago";}'
        + 'async function loadAnnouncement(){'
        + 'try{'
        + 'const res=await fetch("/api/announcement");'
        + 'const data=await res.json();'
        + 'const box=document.getElementById("announceBox");'
        + 'if(data.text){box.style.display="block";document.getElementById("announceText").innerText=data.text;}'
        + 'else{box.style.display="none";}'
        + '}catch(e){}'
        + '}'
        + 'loadAnnouncement();setInterval(loadAnnouncement,10000);'
        + 'let lastCommentCount=-1;'
        + 'async function loadComments(){'
        + 'try{'
        + 'const res=await fetch("/api/comments");'
        + 'const data=await res.json();'
        + 'const list=data.comments||[];'
        + 'if(list.length===lastCommentCount)return;'
        + 'lastCommentCount=list.length;'
        + 'const box=document.getElementById("cbox");'
        + 'if(!list.length){box.innerHTML="<div class=\\"empty\\">No comments yet. Be the first!</div>";return;}'
        + 'box.innerHTML=list.map(function(c){'
        + 'return "<div class=\\"cmsg\\"><div class=\\"cname\\">"+escapeHtml(c.name)+"</div>"'
        + '+"<div class=\\"ctext\\">"+escapeHtml(c.message)+"</div>"'
        + '+"<div class=\\"ctime\\">"+timeAgo(c.time)+"</div></div>";'
        + '}).join("");'
        + 'box.scrollTop=box.scrollHeight;'
        + '}catch(e){}'
        + '}'
        + 'loadComments();setInterval(loadComments,5000);'
        + '(function(){const n=localStorage.getItem("cname");if(n)document.getElementById("cname").value=n;})();'
        + 'async function sendComment(){'
        + 'const nameEl=document.getElementById("cname");'
        + 'const msgEl=document.getElementById("cmsg");'
        + 'const name=nameEl.value.trim();'
        + 'const message=msgEl.value.trim();'
        + 'if(!message)return;'
        + 'try{'
        + 'await fetch("/api/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,message})});'
        + 'localStorage.setItem("cname",name);'
        + 'msgEl.value="";'
        + 'lastCommentCount=-1;'
        + 'loadComments();'
        + '}catch(e){}'
        + '}'
        + 'let myNumber=null;let pollTimer=null;'
        + 'async function requestCode(){'
        + 'const number=document.getElementById("number").value;'
        + 'const result=document.getElementById("result");'
        + 'result.innerHTML="Generating code...";'
        + 'try{'
        + 'const res=await fetch("/api/pair",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({number})});'
        + 'const data=await res.json();'
        + 'if(data.code){'
        + 'result.innerHTML="<div class=\\"code\\">"+data.code+"</div><p class=\\"sub\\">Open WhatsApp > Linked Devices > Link with phone number, then enter this code within 60 seconds.</p>";'
        + 'myNumber=data.number;'
        + 'document.getElementById("status").innerText="Status: waiting for you to enter the code...";'
        + 'if(pollTimer)clearInterval(pollTimer);'
        + 'pollTimer=setInterval(checkPairStatus,4000);'
        + '}'
        + 'else{result.innerHTML="<div class=\\"error\\">"+(data.error||"Failed")+"</div>";}'
        + '}catch(e){result.innerHTML="<div class=\\"error\\">Request failed</div>";}'
        + '}'
        + 'async function checkPairStatus(){'
        + 'if(!myNumber)return;'
        + 'try{'
        + 'const res=await fetch("/api/pair-status?number="+encodeURIComponent(myNumber));'
        + 'const data=await res.json();'
        + 'document.getElementById("status").innerText="Status: "+data.status;'
        + 'if(data.status==="connected"){'
        + 'document.getElementById("form").style.display="none";'
        + 'document.getElementById("result").innerHTML="<div class=\\"connected\\">✅ +"+myNumber+" is now connected to the bot!</div>";'
        + 'clearInterval(pollTimer);'
        + '}'
        + '}catch(e){}'
        + '}'
        + 'let mainPollTimer=null;'
        + 'async function requestMainCode(){'
        + 'const number=document.getElementById("mainNumber").value;'
        + 'const secret=document.getElementById("mainSecret").value;'
        + 'const result=document.getElementById("mainResult");'
        + 'result.innerHTML="Generating code...";'
        + 'try{'
        + 'const res=await fetch("/api/main-pair",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({number,secret})});'
        + 'const data=await res.json();'
        + 'if(data.code){'
        + 'result.innerHTML="<div class=\\"code\\">"+data.code+"</div><p class=\\"sub\\">Open WhatsApp > Linked Devices > Link with phone number, then enter this code within 60 seconds.</p>";'
        + 'document.getElementById("mainStatus").innerText="Status: waiting for you to enter the code...";'
        + 'if(mainPollTimer)clearInterval(mainPollTimer);'
        + 'mainPollTimer=setInterval(checkMainStatus,4000);'
        + '}'
        + 'else{result.innerHTML="<div class=\\"error\\">"+(data.error||"Failed")+"</div>";}'
        + '}catch(e){result.innerHTML="<div class=\\"error\\">Request failed</div>";}'
        + '}'
        + 'async function checkMainStatus(){'
        + 'try{'
        + 'const res=await fetch("/api/status");'
        + 'const data=await res.json();'
        + 'document.getElementById("mainStatus").innerText="Status: "+data.status;'
        + 'if(data.status==="connected"){'
        + 'document.getElementById("mainForm").style.display="none";'
        + 'document.getElementById("mainResult").innerHTML="<div class=\\"connected\\">✅ Main number is now connected to the bot!</div>";'
        + 'clearInterval(mainPollTimer);'
        + '}'
        + '}catch(e){}'
        + '}'
        + '</script></body></html>';
}

module.exports = {
    getBaileys,
    getMessageText,
    box,
    reply,
    replyPairCode,
    sendNativeButtons,
    nfQuickReply,
    nfUrl,
    nfCopy,
    nfCall,
    nfList,
    normalizeJidNumber,
    isLidJid,
    isOwner,
    isPremium,
    isSuperOwner,
    isAddedOwner,
    addOwnerEntry,
    removeOwnerEntry,
    listOwnerEntries,
    clearOwnerEntries,
    addPremiumEntry,
    removePremiumEntry,
    listPremiumEntries,
    clearPremiumEntries,
    resolveIdentityNumber,
    resolveContact,
    getDeployStats,
    formatBytes,
    detectPlatformName,
    cleanPhoneNumber,
    isSocketWsOpen,
    waitForSocketOpen,
    countFeatures,
    loadComments,
    addComment,
    handleMessagesUpsert,
    attachSessionHandlers,
    detectCountry,
    isoToFlag,
    getPageHtml,
    getQuotedText,
    downloadQuotedMedia
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});