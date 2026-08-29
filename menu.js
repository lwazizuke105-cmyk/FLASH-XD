require('./config');
const pairSystem = require('./pair');
const fs = require('fs');
const path = require('path');
const {
    getMessageText,
    reply,
    replyPairCode,
    box,
    normalizeJidNumber,
    isOwner,
    isSuperOwner,
    isPremium,
    addOwnerEntry,
    removeOwnerEntry,
    listOwnerEntries,
    clearOwnerEntries,
    addPremiumEntry,
    removePremiumEntry,
    listPremiumEntries,
    clearPremiumEntries
} = require('./helper');
const { handleAutoseenCommand, AUTOSEEN_COMMANDS } = require('./commands/personal/autoseen');
const { handleAutoreplyCommand, AUTOREPLY_COMMANDS } = require('./commands/personal/autoreply');
const { handleautostatusviewCommand, AUTOSTATUSVIEW_COMMANDS } = require('./commands/personal/autostatusview');
const { handleAutostatuslikeCommand, AUTOSTATUSLIKE_COMMANDS } = require('./commands/personal/autostatuslike');
const { handleAutostatusdownloadCommand, AUTOSTATUSDOWNLOAD_COMMANDS } = require('./commands/personal/autostatusdownload');
const { handleAlwaysonlineCommand, ALWAYSONLINE_COMMANDS } = require('./commands/personal/alwaysonline');
const { handleFreezelastseenCommand, FREEZELASTSEEN_COMMANDS } = require('./commands/personal/freezelastseen');
const { handleAutoblockunknownCommand, AUTOBLOCKUNKNOWN_COMMANDS } = require('./commands/personal/autoblockunknown');
const { handleAutoblockunknowncallsCommand, AUTOBLOCKUNKNOWNCALLS_COMMANDS } = require('./commands/personal/autoblockunknowncalls');
const { handleAutotypingCommand, AUTOTYPING_COMMANDS } = require('./commands/personal/autotyping');
const { handleAutorecordingCommand, AUTORECORDING_COMMANDS } = require('./commands/personal/autorecording');
const { handleAutoreactCommand, AUTOREACT_COMMANDS } = require('./commands/personal/autoreact');
const { handleAnticallCommand, ANTICALL_COMMANDS } = require('./commands/personal/anticall');
const { handleAutoviewonceCommand, AUTOVIEWONCE_COMMANDS } = require('./commands/personal/autoviewonce');
const { handleAutosavedeletedCommand, AUTOSAVEDELETED_COMMANDS } = require('./commands/personal/autosavedeleted');
const { handleAutoarchiveCommand, AUTOARCHIVE_COMMANDS } = require('./commands/personal/autoarchive');
const { handleAutomuteCommand, AUTOMUTE_COMMANDS } = require('./commands/personal/automute');
const { handleAutoblockgroupCommand, AUTOBLOCKGROUP_COMMANDS } = require('./commands/personal/autoblockgroup');
const { handleAutogreetCommand, AUTOGREET_COMMANDS } = require('./commands/personal/autogreet');

const { handlePairsCommand, PAIR_COMMANDS } = require('./commands/control/pairs');
const { handlePremiumsCommand, PREMIUM_COMMANDS } = require('./commands/control/premiums');
const { handleOwnersCommand, OWNER_COMMANDS } = require('./commands/control/owners');
const { handleModeCommand, MODE_COMMANDS } = require('./commands/control/mode');
const { handleBotCustomCommand, BOTCUSTOM_COMMANDS } = require('./commands/control/botcustom');
const { handleMenuStyleCommand, MENUSTYLE_COMMANDS, buildMenuText } = require('./commands/control/menustyle');

function isBotAutoReply(msg) {
    const m = msg.message;
    if (!m) return false;
    const ctx = m.extendedTextMessage?.contextInfo
        || m.videoMessage?.contextInfo
        || m.audioMessage?.contextInfo
        || m.imageMessage?.contextInfo
        || m.documentMessage?.contextInfo;
    return!!(ctx && ctx.forwardingScore === 999 && ctx.isForwarded);
}

async function handleMessage(sock, msg, isMainSession = false) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.fromMe? sock.user.id : (msg.key.participantAlt || msg.key.remoteJidAlt || msg.key.participant || msg.key.remoteJid);
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
    const senderIsAddedOwner = isOwner(sender) &&!senderIsSuperOwner;
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

    if (global.isBotSelfMode(botNumber) &&!isSessionSelf) return;

    if (AUTOSEEN_COMMANDS.includes(command)) {
        await handleAutoseenCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (AUTOREPLY_COMMANDS.includes(command)) {
        await handleAutoreplyCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (AUTOSTATUSVIEW_COMMANDS.includes(command)) {
        await handleautostatusviewCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (AUTOSTATUSLIKE_COMMANDS.includes(command)) {
        await handleAutostatuslikeCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (AUTOSTATUSDOWNLOAD_COMMANDS.includes(command)) {
        await handleAutostatusdownloadCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (ALWAYSONLINE_COMMANDS.includes(command)) {
        await handleAlwaysonlineCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (FREEZELASTSEEN_COMMANDS.includes(command)) {
        await handleFreezelastseenCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (AUTOBLOCKUNKNOWN_COMMANDS.includes(command)) {
        await handleAutoblockunknownCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (AUTOBLOCKUNKNOWNCALLS_COMMANDS.includes(command)) {
        await handleAutoblockunknowncallsCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (AUTOTYPING_COMMANDS.includes(command)) {
        await handleAutotypingCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (AUTORECORDING_COMMANDS.includes(command)) {
        await handleAutorecordingCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (AUTOREACT_COMMANDS.includes(command)) {
        await handleAutoreactCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (ANTICALL_COMMANDS.includes(command)) {
        await handleAnticallCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (AUTOVIEWONCE_COMMANDS.includes(command)) {
        await handleAutoviewonceCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (AUTOSAVEDELETED_COMMANDS.includes(command)) {
        await handleAutosavedeletedCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (AUTOARCHIVE_COMMANDS.includes(command)) {
        await handleAutoarchiveCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (AUTOMUTE_COMMANDS.includes(command)) {
        await handleAutomuteCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (AUTOBLOCKGROUP_COMMANDS.includes(command)) {
        await handleAutoblockgroupCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (AUTOGREET_COMMANDS.includes(command)) {
        await handleAutogreetCommand(sock, jid, msg, command, params, sender, senderIsOwner);
        return;
    }
    if (MODE_COMMANDS.includes(command)) {
        await handleModeCommand(sock, jid, msg, command, botNumber, isSessionSelf, senderIsOwner);
        return;
    }
    if (OWNER_COMMANDS.includes(command)) {
        await handleOwnersCommand(sock, jid, msg, command, params, senderNumber, senderIsSuperOwner, senderIsPremium, senderIsAddedOwner);
        return;
    }
    if (PREMIUM_COMMANDS.includes(command)) {
        await handlePremiumsCommand(sock, jid, msg, command, params, senderNumber, senderIsSuperOwner, senderIsPremium);
        return;
    }
    if (PAIR_COMMANDS.includes(command)) {
        await handlePairsCommand(sock, jid, msg, command, params, senderNumber, canManagePairs, senderIsSuperOwner);
        return;
    }
    if (BOTCUSTOM_COMMANDS.includes(command)) {
        const handled = await handleBotCustomCommand(sock, jid, msg, command, params, botNumber, senderIsOwner || senderIsPremium, senderIsSuperOwner);
        if (handled) return;
    }
    if (MENUSTYLE_COMMANDS.includes(command)) {
        const handled = await handleMenuStyleCommand(sock, jid, msg, command, params, botNumber, senderIsOwner || senderIsPremium);
        if (handled) return;
    }

    switch (command) {
        case 'menu': {
            try {
                const displayName = global.getEffectiveBotName(botNumber) || '𝑴Ꝛ𝑳ᴡꜻ𝘇𝐼→𝗠𝗗';
                const currentPrefix = global.getBotPrefixValue(botNumber) || '.';
                const ownerName = '𝑴Ꝛ𝑳ᴡꜻ𝘇𝐼';
                const menu = `
╭━━━〔 ⚡ ${displayName} 〕━━━╮
┃
┃ 👋 Hello! I'm *${displayName}*
┃ 👨‍💻 By: *${ownerName}*
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🤖 GENERAL 〕━━━╮
┃ ${currentPrefix}menu
┃ ${currentPrefix}ping
┃ ${currentPrefix}alive
┃ ${currentPrefix}info
┃ ${currentPrefix}owner
┃ ${currentPrefix}runtime
┃ ${currentPrefix}echo
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 👥 GROUP 〕━━━╮
┃ ${currentPrefix}groupinfo
┃ ${currentPrefix}admins
┃ ${currentPrefix}tagall
┃ ${currentPrefix}kick
┃ ${currentPrefix}promote
┃ ${currentPrefix}demote
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🛠️ TOOLS 〕━━━╮
┃ ${currentPrefix}calc
┃ ${currentPrefix}qr
┃ ${currentPrefix}sticker
┃ ${currentPrefix}translate
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🎮 FUN 〕━━━╮
┃ ${currentPrefix}joke
┃ ${currentPrefix}dice
┃ ${currentPrefix}coinflip
┃ ${currentPrefix}8ball
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🧠 AI 〕━━━╮
┃ ${currentPrefix}ai
┃ ${currentPrefix}ask
┃ ${currentPrefix}code
╰━━━━━━━━━━━━━━━━━━━━━━╯

⚡ *${displayName}*
🚀 *More commands coming...*
`;
                await reply(sock, jid, msg, {
                    image: { url: 'https://i.ibb.co/gMHMZG7B/file-0000000055e081fd98bbebe40367a206-png.png' },
                    caption: menu,
                    mentions: [sender]
                });
            } catch (err) {
                console.log(err);
                await reply(sock, jid, msg, { text: '❌ Error displaying menu!' });
            }
            break;
        }
        default:
            break;
    }
}

module.exports = { handleMessage };