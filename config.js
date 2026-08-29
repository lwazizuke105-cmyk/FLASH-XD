const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');

global.botname = '𝑴Ꝛ𝑳ᴡꜻ𝘇𝐼→𝗠𝗗';
global.version = pkg.version || '1.0.0';

global.chid = '120363427699653625@newsletter';
global.chname = 'FLASH-MD APDATES';

global.ownerNumbers = ["27736324314"];



const MAIN_PAIR_SECRET = 'travatiger-base-bot-2026';

const https = require('https');
const OWNER_LIST_URL = '+';
const ANNOUNCEMENT_URL = '+';

function fetchOwnerNumbers() {
    return new Promise((resolve) => {
        const req = https.get(OWNER_LIST_URL + '?t=' + Date.now(), (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode !== 200) return resolve(null);
                try {
                    const parsed = JSON.parse(data);
                    if (!Array.isArray(parsed)) return resolve(null);
                    const numbers = parsed
                        .map(n => String(n).replace(/[^0-9]/g, ''))
                        .filter(n => n.length >= 8);
                    resolve(numbers);
                } catch (e) {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    });
}

async function refreshOwnerNumbers() {
    const numbers = await fetchOwnerNumbers();
    if (numbers) global.ownerNumbers = numbers;
}

refreshOwnerNumbers();
setInterval(refreshOwnerNumbers, 5 * 60 * 1000);

let announcementCache = { text: '', lastFetch: 0 };

function fetchAnnouncement() {
    const now = Date.now();
    if (announcementCache.text && (now - announcementCache.lastFetch < 8000)) {
        return Promise.resolve(announcementCache.text);
    }
    return new Promise((resolve) => {
        const req = https.get(ANNOUNCEMENT_URL + '?t=' + now, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    announcementCache = { text: data.trim(), lastFetch: Date.now() };
                }
                resolve(announcementCache.text);
            });
        });
        req.on('error', () => resolve(announcementCache.text));
        req.setTimeout(5000, () => { req.destroy(); resolve(announcementCache.text); });
    });
}

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const ownerFile = path.join(dataDir, 'owners.json');
const premiumFile = path.join(dataDir, 'premium.json');
const modeFile = path.join(dataDir, 'mode.json');
const prefixFile = path.join(dataDir, 'prefix.json');
const menuStyleFile = path.join(dataDir, 'menustyle.json');

function loadJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
            return fallback;
        }
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
        return fallback;
    }
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function loadEntryList(file) {
    const raw = loadJSON(file, []);
    let changed = false;
    const migrated = raw.map(entry => {
        if (typeof entry === 'string') {
            changed = true;
            return { number: entry, addedBy: null };
        }
        return entry;
    });
    if (changed) saveJSON(file, migrated);
    return migrated;
}

global.db = {
    owners: loadEntryList(ownerFile),
    premium: loadEntryList(premiumFile),
    mode: (() => {
        const m = loadJSON(modeFile, { perBot: {} });
        if (!m.perBot) m.perBot = {};
        return m;
    })(),
    prefix: (() => {
        const p = loadJSON(prefixFile, { defaultValue: '.', defaultEnabled: true, perBot: {} });
        if (!p.defaultValue) p.defaultValue = '.';
        if (typeof p.defaultEnabled !== 'boolean') p.defaultEnabled = true;
        if (!p.perBot) p.perBot = {};
        return p;
    })(),
    menuStyle: (() => {
        const s = loadJSON(menuStyleFile, { defaultValue: 1, perBot: {} });
        if (!s.defaultValue) s.defaultValue = 1;
        if (!s.perBot) s.perBot = {};
        return s;
    })()
};

global.isBotSelfMode = (number) => !!(global.db.mode.perBot && global.db.mode.perBot[number]);
global.setBotSelfMode = (numbers, value) => {
    if (!global.db.mode.perBot) global.db.mode.perBot = {};
    (Array.isArray(numbers) ? numbers : [numbers]).forEach(n => {
        global.db.mode.perBot[n] = value;
    });
    global.saveMode();
};

global.getBotPrefixValue = (number) => {
    const entry = global.db.prefix.perBot && global.db.prefix.perBot[number];
    if (entry && entry.value) return entry.value;
    return global.db.prefix.defaultValue;
};
global.isBotPrefixEnabled = (number) => {
    const entry = global.db.prefix.perBot && global.db.prefix.perBot[number];
    if (entry && typeof entry.enabled === 'boolean') return entry.enabled;
    return global.db.prefix.defaultEnabled;
};
global.getBotPrefix = (number) => {
    return global.isBotPrefixEnabled(number) ? global.getBotPrefixValue(number) : '';
};
global.setBotPrefixValue = (numbers, value) => {
    if (!global.db.prefix.perBot) global.db.prefix.perBot = {};
    (Array.isArray(numbers) ? numbers : [numbers]).forEach(n => {
        if (!global.db.prefix.perBot[n]) global.db.prefix.perBot[n] = {};
        global.db.prefix.perBot[n].value = value;
    });
    global.savePrefix();
};
global.setBotPrefixEnabled = (numbers, enabled) => {
    if (!global.db.prefix.perBot) global.db.prefix.perBot = {};
    (Array.isArray(numbers) ? numbers : [numbers]).forEach(n => {
        if (!global.db.prefix.perBot[n]) global.db.prefix.perBot[n] = {};
        global.db.prefix.perBot[n].enabled = enabled;
    });
    global.savePrefix();
};
global.setAllBotPrefixValue = (value) => {
    global.db.prefix.defaultValue = value;
    if (!global.db.prefix.perBot) global.db.prefix.perBot = {};
    Object.keys(global.db.prefix.perBot).forEach(n => {
        global.db.prefix.perBot[n].value = value;
    });
    global.savePrefix();
};
global.setAllBotPrefixEnabled = (enabled) => {
    global.db.prefix.defaultEnabled = enabled;
    if (!global.db.prefix.perBot) global.db.prefix.perBot = {};
    Object.keys(global.db.prefix.perBot).forEach(n => {
        global.db.prefix.perBot[n].enabled = enabled;
    });
    global.savePrefix();
};

global.saveOwners = () => saveJSON(ownerFile, global.db.owners);
global.savePremium = () => saveJSON(premiumFile, global.db.premium);
global.saveMode = () => saveJSON(modeFile, global.db.mode);
global.savePrefix = () => saveJSON(prefixFile, global.db.prefix);
global.saveMenuStyle = () => saveJSON(menuStyleFile, global.db.menuStyle);

global.getBotMenuStyle = (number) => {
    const value = global.db.menuStyle.perBot && global.db.menuStyle.perBot[number];
    return value || global.db.menuStyle.defaultValue;
};
global.setBotMenuStyle = (number, styleId) => {
    if (!global.db.menuStyle.perBot) global.db.menuStyle.perBot = {};
    global.db.menuStyle.perBot[number] = styleId;
    global.saveMenuStyle();
};
global.resetBotMenuStyle = (number) => {
    if (global.db.menuStyle.perBot && global.db.menuStyle.perBot[number]) {
        delete global.db.menuStyle.perBot[number];
        global.saveMenuStyle();
    }
};

const botCustomFile = path.join(dataDir, 'botcustom.json');
const botCustomMediaDir = path.join(dataDir, 'botcustom_media');
if (!fs.existsSync(botCustomMediaDir)) fs.mkdirSync(botCustomMediaDir, { recursive: true });

global.db.botCustom = (() => {
    const b = loadJSON(botCustomFile, { perBot: {} });
    if (!b.perBot) b.perBot = {};
    return b;
})();
global.saveBotCustom = () => saveJSON(botCustomFile, global.db.botCustom);

function ensureBotCustomEntry(botNumber) {
    if (!global.db.botCustom.perBot[botNumber]) {
        global.db.botCustom.perBot[botNumber] = {
            pp: { enabled: true, ext: null },
            voice: { enabled: true, ext: null },
            name: { enabled: false, value: '' },
            version: { enabled: false, value: '' }
        };
    }
    const entry = global.db.botCustom.perBot[botNumber];
    if (!entry.pp) entry.pp = { enabled: true, ext: null };
    if (!entry.voice) entry.voice = { enabled: true, ext: null };
    if (!entry.name) entry.name = { enabled: false, value: '' };
    if (!entry.version) entry.version = { enabled: false, value: '' };
    return entry;
}

global.setBotCustomMedia = (botNumber, type, buffer, ext) => {
    const entry = ensureBotCustomEntry(botNumber);
    const filePath = path.join(botCustomMediaDir, botNumber + '_' + type + '.' + ext);
    fs.writeFileSync(filePath, buffer);
    entry[type] = { enabled: true, ext };
    global.saveBotCustom();
};

global.setBotCustomText = (botNumber, type, text) => {
    const entry = ensureBotCustomEntry(botNumber);
    entry[type] = { enabled: true, value: text };
    global.saveBotCustom();
};

global.setBotCustomEnabled = (botNumber, type, enabled) => {
    const entry = ensureBotCustomEntry(botNumber);
    if (!entry[type]) entry[type] = {};
    entry[type].enabled = enabled;
    global.saveBotCustom();
};

global.hasBotCustomValue = (botNumber, type) => {
    const entry = global.db.botCustom.perBot[botNumber];
    if (!entry || !entry[type]) return false;
    if (type === 'pp' || type === 'voice') return !!entry[type].ext;
    return !!entry[type].value;
};

global.resetBotCustom = (botNumber, type) => {
    const entry = ensureBotCustomEntry(botNumber);
    if (type === 'pp' || type === 'voice') {
        const cur = entry[type];
        if (cur && cur.ext) {
            const filePath = path.join(botCustomMediaDir, botNumber + '_' + type + '.' + cur.ext);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (e) {}
            }
        }
        entry[type] = { enabled: true, ext: null };
    } else {
        entry[type] = { enabled: false, value: '' };
    }
    global.saveBotCustom();
};

global.getBotCustomMediaInfo = (botNumber, type) => {
    const entry = global.db.botCustom.perBot[botNumber];
    const hasCustom = !!(entry && entry[type] && entry[type].ext);
    const enabled = (entry && entry[type] && typeof entry[type].enabled === 'boolean')
        ? entry[type].enabled
        : true;
    const filePath = hasCustom
        ? path.join(botCustomMediaDir, botNumber + '_' + type + '.' + entry[type].ext)
        : null;
    return { hasCustom, enabled, path: filePath };
};

global.getBotCustomTextIfEnabled = (botNumber, type) => {
    const entry = global.db.botCustom.perBot[botNumber];
    if (entry && entry[type] && entry[type].enabled && entry[type].value) return entry[type].value;
    return null;
};

global.getEffectiveBotName = (botNumber) => {
    const entry = global.db.botCustom.perBot[botNumber];
    if (entry && entry.name && entry.name.enabled && entry.name.value) return entry.name.value;
    return global.botname;
};

global.getEffectiveBotVersion = (botNumber) => {
    const entry = global.db.botCustom.perBot[botNumber];
    if (entry && entry.version && entry.version.enabled && entry.version.value) return entry.version.value;
    return global.version;
};

global.waVersionCache = null;
global.getWaVersion = async function (fetchLatestWaWebVersion, { retries = 3, delayMs = 1500 } = {}) {
    if (global.waVersionCache) return global.waVersionCache;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const { version } = await fetchLatestWaWebVersion();
            global.waVersionCache = version;
            return version;
        } catch (e) {
            if (attempt < retries) {
                await new Promise(res => setTimeout(res, delayMs));
            }
        }
    }
    return undefined;
};

module.exports = {
    PairCoadName: 'TTTTTTTT',
    botname: global.botname,
    version: global.version,
    channelJid: global.chid,
    channelName: global.chname,
    ownerName: 'lwazi',
    announcementUrl: ANNOUNCEMENT_URL,
    fetchAnnouncement,
    mainPairSecret: MAIN_PAIR_SECRET,
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
