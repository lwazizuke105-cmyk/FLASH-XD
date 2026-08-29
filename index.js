let makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion, Browsers;
async function loadBaileys() {
    const baileys = await import('@mrlegendbot/baileys');
    makeWASocket = baileys.default;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
    fetchLatestWaWebVersion = baileys.fetchLatestWaWebVersion;
    Browsers = baileys.Browsers;
}

const pino = require('pino');
const express = require('express');
const fs = require('fs');
const path = require('path');

const config = require('./config');
const {
    normalizeJidNumber,
    cleanPhoneNumber,
    waitForSocketOpen,
    countFeatures,
    loadComments,
    addComment,
    attachSessionHandlers,
    getPageHtml
} = require('./helper');
const pairSystem = require('./pair');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 14811;
const SESSION_DIR = './session';

let sock = null;
let botStatus = 'starting';
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

const botStartTime = Date.now();

function deleteSession() {
    try {
        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        }
    } catch (e) {}
}

async function requestMainPairingCode(number) {
    if (!sock) {
        throw new Error('Bot is not ready yet, try again in a few seconds.');
    }
    if (sock.authState.creds.registered) {
        deleteSession();
        sock = null;
        await startBot();
        if (!sock) {
            throw new Error('Bot is not ready yet, try again in a few seconds.');
        }
    }
    const opened = await waitForSocketOpen(sock, 15000);
    if (!opened) {
        throw new Error('Connection did not open in time, please try again.');
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
    let lastError;
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            return await sock.requestPairingCode(number, config.PairCoadName);
        } catch (e) {
            lastError = e;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    throw lastError;
}

async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

        const version = await global.getWaVersion(fetchLatestWaWebVersion);

        sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            connectTimeoutMs: 180000,
            defaultQueryTimeoutMs: 120000,
            keepAliveIntervalMs: 15000,
            browser: Browsers.ubuntu('Chrome'),
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false
        });

        botStatus = sock.authState.creds.registered ? 'connecting' : 'waiting_for_number';

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const isLoggedOut = statusCode === DisconnectReason.loggedOut;
                const isBadSession = statusCode === DisconnectReason.badSession;

                if (isLoggedOut || isBadSession) {
                    botStatus = 'logged_out';
                    deleteSession();
                    reconnectAttempts = 0;
                    setTimeout(() => startBot(), 2000);
                    return;
                }

                reconnectAttempts++;
                botStatus = 'reconnecting';

                if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                    deleteSession();
                    reconnectAttempts = 0;
                    setTimeout(() => startBot(), 3000);
                    return;
                }

                setTimeout(() => startBot(), 3000);
            } else if (connection === 'open') {
                botStatus = 'connected';
                reconnectAttempts = 0;
                global.mainBotNumber = normalizeJidNumber(sock.user.id);
                console.log('✅ ' + global.botname + ' v' + global.version + ' connected successfully!');
            }
        });

        attachSessionHandlers(sock, true);

        return sock;
    } catch (error) {
        setTimeout(() => startBot(), 5000);
    }
}

app.get('/', (req, res) => {
    res.send(getPageHtml());
});

app.get('/api/status', (req, res) => {
    res.json({ status: botStatus, botname: global.botname, version: global.version });
});

app.post('/api/main-pair', async (req, res) => {
    try {
        const secret = String(req.body.secret || '');
        if (!secret || secret !== config.mainPairSecret) {
            return res.status(403).json({ error: 'Invalid secret key.' });
        }
        const number = cleanPhoneNumber(req.body.number || '');
        if (!number || number.length < 8) {
            return res.status(400).json({ error: 'Please enter a valid number with country code.' });
        }
        const code = await requestMainPairingCode(number);
        res.json({ code, number });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Failed to generate pairing code. Please try again.' });
    }
});

app.post('/api/pair', async (req, res) => {
    try {
        const number = cleanPhoneNumber(req.body.number || '');
        if (!number || number.length < 8) {
            return res.status(400).json({ error: 'Please enter a valid number with country code.' });
        }
        if (!sock) {
            return res.status(400).json({ error: 'Bot is not ready yet, try again in a few seconds.' });
        }

        const result = await pairSystem.addWebPair(number, sock);
        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json({ code: result.code, number: result.number });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Failed to generate pairing code. Please try again.' });
    }
});

app.get('/api/stats', (req, res) => {
    const pairStats = pairSystem.getStats();
    const mainRegistered = !!(sock && sock.authState && sock.authState.creds.registered);
    const mainOnline = botStatus === 'connected' ? 1 : 0;
    const mainTotal = mainRegistered ? 1 : 0;
    res.json({
        totalPairs: pairStats.total,
        onlinePairs: pairStats.online,
        offlinePairs: pairStats.offline,
        mainTotal,
        mainOnline,
        mainOffline: mainTotal - mainOnline,
        uptimeSeconds: Math.floor((Date.now() - botStartTime) / 1000),
        totalFeatures: countFeatures(),
        owner: config.ownerName,
        countries: pairSystem.getCountryStats()
    });
});

app.get('/api/announcement', async (req, res) => {
    const text = await config.fetchAnnouncement();
    res.json({ text });
});

app.get('/api/comments', (req, res) => {
    const list = loadComments().slice(-50);
    res.json({ comments: list });
});

app.post('/api/comments', (req, res) => {
    const result = addComment(req.body.name, req.body.message);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ ok: true, entry: result.entry });
});

app.get('/api/pair-status', (req, res) => {
    const number = cleanPhoneNumber(req.query.number || '');
    if (!number) return res.json({ status: 'idle' });
    res.json({ status: pairSystem.getSessionStatus(number) });
});

app.listen(PORT, async () => {
    console.log('🚀 Server listening on port ' + PORT);
    await loadBaileys();
    startBot();
    pairSystem.restorePairs(null);
});