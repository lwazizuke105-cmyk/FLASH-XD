require('./config');
const pairSystem = require('./pair');
const fs = require('fs');
const {
    getMessageText,
    reply,
    replyPairCode,
    box,
    normalizeJidNumber,
    isOwner,
    isSuperOwner,
    isPremium
} = require('./helper');
const { handleGCBasicCommand } = require('./commands/group/gcbasic');

const { handleAutoseenCommand } = require('./commands/personal/autoseen');
const { handleAutoreplyCommand } = require('./commands/personal/autoreply');
const { handleautostatusviewCommand } = require('./commands/personal/autostatusview');
const { handleAutostatuslikeCommand } = require('./commands/personal/autostatuslike');
const { handleAutostatusdownloadCommand } = require('./commands/personal/autostatusdownload');
const { handleAlwaysonlineCommand } = require('./commands/personal/alwaysonline');
const { handleFreezelastseenCommand } = require('./commands/personal/freezelastseen');
const { handleAutoblockunknownCommand } = require('./commands/personal/autoblockunknown');
const { handleAutoblockunknowncallsCommand } = require('./commands/personal/autoblockunknowncalls');
const { handleAutotypingCommand } = require('./commands/personal/autotyping');
const { handleAutorecordingCommand } = require('./commands/personal/autorecording');
const { handleAutoreactCommand } = require('./commands/personal/autoreact');
const { handleAnticallCommand } = require('./commands/personal/anticall');
const { handleAutoviewonceCommand } = require('./commands/personal/autoviewonce');
const { handleAutosavedeletedCommand } = require('./commands/personal/autosavedeleted');
const { handleAutoarchiveCommand } = require('./commands/personal/autoarchive');
const { handleAutomuteCommand } = require('./commands/personal/automute');
const { handleAutoblockgroupCommand } = require('./commands/personal/autoblockgroup');
const { handleAutogreetCommand } = require('./commands/personal/autogreet');

const { handlePairsCommand } = require('./commands/control/pairs');
const { handlePremiumsCommand } = require('./commands/control/premiums');
const { handleOwnersCommand } = require('./commands/control/owners');
const { handleModeCommand } = require('./commands/control/mode');
const { handleBotCustomCommand } = require('./commands/control/botcustom');

function buildMenuText(pfx, info) {
    const header = `╭━━━━━━━━━━━━━━━━━━━━
┃ › Name: *${info.displayName}*
┃ › Version: *${info.displayVersion}*
┃ › Mode: *${info.mode}*
┃ › Prefix: *${info.currentPrefix}* (${info.prefixStatus})
┃ › User: ${info.name}
┃ › Time: ${info.time}
┃━━━━━━━━━━━━━━━━━━━━
┃ › *control commands*
┃━━━━━━━━━━━━━━━━━━━━
┃ › ${pfx}self
┃ › ${pfx}public
┃ › ${pfx}botpp on / off
┃ › ${pfx}setbotpp
┃ › ${pfx}restartpp
┃ › ${pfx}botprefix on / off
┃ › ${pfx}setbotprefix
┃ › ${pfx}restartprefix
┃ › ${pfx}botvoice on / off
┃ › ${pfx}setbotvoice
┃ › ${pfx}restartvoice
┃ › ${pfx}botname on / off
┃ › ${pfx}setbotname
┃ › ${pfx}restartname
┃ › ${pfx}botverssion on / off
┃ › ${pfx}setbotverssion
┃ › ${pfx}restartverssion
┃━━━━━━━━━━━━━━━━━━━━
┃ › *owner commands*
┃━━━━━━━━━━━━━━━━━━━━
┃ › ${pfx}addowner
┃ › ${pfx}delowner
┃ › ${pfx}listowner
┃ › ${pfx}clearowner
┃━━━━━━━━━━━━━━━━━━━━
┃ › *premium commands*
┃━━━━━━━━━━━━━━━━━━━━
┃ › ${pfx}addpremium
┃ › ${pfx}delpremium
┃ › ${pfx}listpremium
┃ › ${pfx}clearpremium
┃━━━━━━━━━━━━━━━━━━━━
┃ › *pair commands*
┃━━━━━━━━━━━━━━━━━━━━
┃ › ${pfx}addpair
┃ › ${pfx}delpair
┃ › ${pfx}listpair
┃ › ${pfx}clearpair
┃━━━━━━━━━━━━━━━━━━━━
┃ › *group commands*
┃━━━━━━━━━━━━━━━━━━━━
┃ › ${pfx}del
┃ › ${pfx}delall
┃ › ${pfx}tagall
┃ › ${pfx}taghide
┃ › ${pfx}tagadmins
┃ › ${pfx}tagmembers
┃ › ${pfx}kick
┃ › ${pfx}kickall
┃ › ${pfx}promote
┃ › ${pfx}promoteall
┃ › ${pfx}demote
┃ › ${pfx}demoteall
┃ › ${pfx}gpgetname
┃ › ${pfx}gpsetname
┃ › ${pfx}gpgetdesc
┃ › ${pfx}gpsetdesc
┃ › ${pfx}gpgetpic
┃ › ${pfx}gpsetpic
┃━━━━━━━━━━━━━━━━━━━━
┃ › *Personal commands*
┃━━━━━━━━━━━━━━━━━━━━
┃ › *on / off*
┃━━━━━━━━━━━━━━━━━━━━
┃ › ${pfx}autoseen
┃ › ${pfx}autoreply
┃ › ${pfx}alwaysonline
┃ › ${pfx}autoblockunknown
┃ › ${pfx}autoblockunknowncalls
┃ › ${pfx}autotyping
┃ › ${pfx}autorecording
┃ › ${pfx}autoreact
┃ › ${pfx}anticall
┃ › ${pfx}autoviewonce
┃ › ${pfx}autosavedeleted
┃ › ${pfx}autoarchive
┃ › ${pfx}automute
┃ › ${pfx}autoblockgroup
┃ › ${pfx}autogreet
┃ › ${pfx}autostatuslike
┃ › ${pfx}autostatusview
┃ › ${pfx}autostatusdownload
╰━━━━━━━━━━━━━━━━━━━━`;
    return header;
}

async function handleMessage(sock, msg, isMainSession = false) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.fromMe ? sock.user.id : (msg.key.participantAlt || msg.key.remoteJidAlt || msg.key.participant || msg.key.remoteJid);
    const senderNumber = normalizeJidNumber(sender);
    const botNumber = normalizeJidNumber(sock.user.id);

    const text = getMessageText(msg).trim();

    if (!text) return;

    const botPrefix = global.getBotPrefix(botNumber);
    let body = text;
    if (botPrefix) {
        if (!text.toLowerCase().startsWith(botPrefix.toLowerCase())) return;
        body = text.slice(botPrefix.length).trim();
        if (!body) return;
    }

    const args = body.split(/\s+/);
    const command = args[0].toLowerCase();
    const params = args.slice(1);

    const isBotSelf = msg.key.fromMe || senderNumber === botNumber;
    const senderIsOwner = isOwner(sender) || isBotSelf;
    const isSessionSelf = senderIsOwner || isBotSelf;

    const senderIsSuperOwner = isSuperOwner(sender) || (isMainSession && (msg.key.fromMe || senderNumber === botNumber));
    const senderIsPremium = isPremium(sender) || senderIsSuperOwner;
    const senderIsAddedOwner = isOwner(sender) && !senderIsSuperOwner;
    const canManagePairs = senderIsPremium || senderIsAddedOwner;

    if (pairSystem.isPendingNumberRequest(jid)) {
        pairSystem.clearPendingNumberRequest(jid);
        const result = await pairSystem.addPair(text, jid, sock, senderNumber, senderIsSuperOwner);
        if (result.error) {
            await reply(sock, jid, msg, box('ADD PAIR', result.error));
        } else if (result.code) {
            await replyPairCode(sock, jid, msg, result.number, result.code);
        } else {
            await reply(sock, jid, msg, box('ADD PAIR', 'Number +' + result.number + ' is already linked.'));
        }
        return;
    }

    if (global.isBotSelfMode(botNumber) && !isSessionSelf) return;

    if (await handleAutoseenCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAutoreplyCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleautostatusviewCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAutostatuslikeCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAutostatusdownloadCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAlwaysonlineCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleFreezelastseenCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAutoblockunknownCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAutoblockunknowncallsCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAutotypingCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAutorecordingCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAutoreactCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAnticallCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAutoviewonceCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAutosavedeletedCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAutoarchiveCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAutomuteCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAutoblockgroupCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    if (await handleAutogreetCommand(sock, jid, msg, command, params, sender, senderIsOwner)) return;
    
    if (await handleModeCommand(sock, jid, msg, command, botNumber, isSessionSelf, senderIsOwner)) return;
    if (await handleOwnersCommand(sock, jid, msg, command, params, senderNumber, senderIsSuperOwner, senderIsPremium, senderIsAddedOwner)) return;
    if (await handlePremiumsCommand(sock, jid, msg, command, params, senderNumber, senderIsSuperOwner, senderIsPremium)) return;
    if (await handlePairsCommand(sock, jid, msg, command, params, senderNumber, canManagePairs, senderIsSuperOwner)) return;
    if (await handleBotCustomCommand(sock, jid, msg, command, params, botNumber, senderIsOwner || senderIsPremium, senderIsSuperOwner)) return;
    const gcHandled = await handleGCBasicCommand(sock, jid, msg, command, params, sender, senderIsOwner);
    if (gcHandled) return;
    switch (command) {
case 'menu': {
    try {
        const time = new Date().toLocaleTimeString("en-US");
        const name = msg.pushName || 'User';
        const mode = global.isBotSelfMode(botNumber) ? 'Self Mode' : 'Public Mode';
        const currentPrefix = global.getBotPrefixValue(botNumber);
        const prefixStatus = global.isBotPrefixEnabled(botNumber) ? 'ON' : 'OFF';
        const displayName = global.getEffectiveBotName(botNumber);
        const displayVersion = global.getEffectiveBotVersion(botNumber);
        const pfx = global.isBotPrefixEnabled(botNumber) ? currentPrefix : '';

        const caption = buildMenuText(pfx, {
            displayName,
            displayVersion,
            mode,
            currentPrefix,
            prefixStatus,
            name,
            time
        });
        const ppInfo = global.getBotCustomMediaInfo(botNumber, 'pp');
        const voiceInfo = global.getBotCustomMediaInfo(botNumber, 'voice');

        let imageToSend = null;
        if (ppInfo.hasCustom && ppInfo.enabled && fs.existsSync(ppInfo.path)) {
            imageToSend = ppInfo.path;
        }

        if (imageToSend) {
            await reply(sock, jid, msg, {
                image: fs.readFileSync(imageToSend),
                caption: caption,
                mentions: [sender]
            });
        } else {
            await reply(sock, jid, msg, {
                text: caption,
                mentions: [sender]
            });
        }

        let audioToSend = null;
        if (voiceInfo.hasCustom && voiceInfo.enabled && fs.existsSync(voiceInfo.path)) {
            audioToSend = voiceInfo.path;
        }

        if (audioToSend) {
            await reply(sock, jid, msg, {
                audio: fs.readFileSync(audioToSend),
                mimetype: 'audio/mpeg',
                ptt: false
            });
        }
    } catch (err) {
        await reply(sock, jid, msg, { text: '❌ Error displaying menu!', mentions: [sender] });
    }
    break;
}        
        
        default:
            break;
    }
}

module.exports = { handleMessage };

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
