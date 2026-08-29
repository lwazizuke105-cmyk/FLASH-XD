const {
    reply,
    box,
    getQuotedText,
    downloadQuotedMedia
} = require('../../helper');

const MEDIA_TYPES = {
    pp: { label: 'BOT PP', accepts: ['image'] },
    voice: { label: 'BOT VOICE', accepts: ['audio'] }
};

const TEXT_TYPES = {
    name: { label: 'BOT NAME' },
    version: { label: 'BOT VERSION' }
};

function notOwnerMsg() {
    return 'Only the bot owner can use this command.';
}

const MAX_PREFIX_LENGTH = 5;

function isValidPrefix(prefix) {
    return typeof prefix === 'string' && prefix.length > 0 && prefix.length <= MAX_PREFIX_LENGTH && !/\s/.test(prefix);
}

const BOTCUSTOM_COMMANDS = [
    'setbotpp', 'restartpp', 'botpp',
    'setbotvoice', 'restartvoice', 'restartboice', 'botvoice',
    'setbotname', 'restartname', 'botname',
    'setbotverssion', 'restartverssion', 'botverssion',
    'setbotprefix', 'restartprefix', 'botprefix'
];

async function handleSetBotMediaCommand(sock, jid, msg, type, botNumber, senderIsOwner) {
    const meta = MEDIA_TYPES[type];
    if (!senderIsOwner) {
        await reply(sock, jid, msg, box(meta.label, notOwnerMsg()));
        return;
    }

    const media = await downloadQuotedMedia(msg);
    if (!media || !meta.accepts.includes(media.type)) {
        const hint = type === 'pp'
            ? 'Reply to any image with this command.\nExample: reply to a photo -> setbotpp'
            : 'Reply to any audio or voice note with this command.\nExample: reply to a voice note -> setbotvoice';
        await reply(sock, jid, msg, box(meta.label, hint));
        return;
    }

    const ext = media.type === 'image' ? 'jpg' : 'mp3';
    global.setBotCustomMedia(botNumber, type, media.buffer, ext);

    const offCmd = type === 'pp' ? 'botpp off' : 'botvoice off';
    const noun = type === 'pp' ? 'picture' : 'voice';
    await reply(sock, jid, msg, box(meta.label, 'Set successfully! This ' + noun + ' will now show in the menu.\nTo turn it off: ' + offCmd));
}

async function handleRestartMediaCommand(sock, jid, msg, type, botNumber, senderIsOwner) {
    const meta = MEDIA_TYPES[type];
    if (!senderIsOwner) {
        await reply(sock, jid, msg, box(meta.label, notOwnerMsg()));
        return;
    }
    global.resetBotCustom(botNumber, type);
    await reply(sock, jid, msg, box(meta.label, 'Reverted back to the original (default) state.'));
}

async function handleToggleMediaCommand(sock, jid, msg, type, params, botNumber, senderIsOwner) {
    const meta = MEDIA_TYPES[type];
    if (!senderIsOwner) {
        await reply(sock, jid, msg, box(meta.label, notOwnerMsg()));
        return;
    }
    const state = (params[0] || '').toLowerCase();
    if (state !== 'on' && state !== 'off') {
        const cmd = type === 'pp' ? 'botpp' : 'botvoice';
        await reply(sock, jid, msg, box(meta.label, 'Correct usage: ' + cmd + ' on or ' + cmd + ' off'));
        return;
    }
    global.setBotCustomEnabled(botNumber, type, state === 'on');
    await reply(sock, jid, msg, box(meta.label, meta.label + ' is now ' + state.toUpperCase() + '.'));
}

async function handleSetBotTextCommand(sock, jid, msg, type, botNumber, senderIsOwner) {
    const meta = TEXT_TYPES[type];
    if (!senderIsOwner) {
        await reply(sock, jid, msg, box(meta.label, notOwnerMsg()));
        return;
    }
    const quotedText = getQuotedText(msg).trim();
    if (!quotedText) {
        const cmd = type === 'name' ? 'setbotname' : 'setbotverssion';
        await reply(sock, jid, msg, box(meta.label, 'Reply to any text/name with ' + cmd + '.'));
        return;
    }
    global.setBotCustomText(botNumber, type, quotedText);
    const offCmd = type === 'name' ? 'botname off' : 'botverssion off';
    await reply(sock, jid, msg, box(meta.label, 'Set successfully: ' + quotedText + '\nTo turn it off: ' + offCmd));
}

async function handleRestartTextCommand(sock, jid, msg, type, botNumber, senderIsOwner) {
    const meta = TEXT_TYPES[type];
    if (!senderIsOwner) {
        await reply(sock, jid, msg, box(meta.label, notOwnerMsg()));
        return;
    }
    global.resetBotCustom(botNumber, type);
    await reply(sock, jid, msg, box(meta.label, 'Reverted back to the original (default) state.'));
}

async function handleToggleTextCommand(sock, jid, msg, type, params, botNumber, senderIsOwner) {
    const meta = TEXT_TYPES[type];
    if (!senderIsOwner) {
        await reply(sock, jid, msg, box(meta.label, notOwnerMsg()));
        return;
    }
    const state = (params[0] || '').toLowerCase();
    if (state !== 'on' && state !== 'off') {
        const cmd = type === 'name' ? 'botname' : 'botverssion';
        await reply(sock, jid, msg, box(meta.label, 'Correct usage: ' + cmd + ' on or ' + cmd + ' off'));
        return;
    }
    global.setBotCustomEnabled(botNumber, type, state === 'on');
    await reply(sock, jid, msg, box(meta.label, meta.label + ' is now ' + state.toUpperCase() + '.'));
}

async function handleSetBotPrefixCommand(sock, jid, msg, params, botNumber, senderIsOwner, senderIsSuperOwner) {
    const newPrefix = params[0];
    const scopeAll = (params[1] || '').toLowerCase() === 'all';

    if (!isValidPrefix(newPrefix)) {
        await reply(sock, jid, msg, box('SET BOT PREFIX', 'Correct usage:\nsetbotprefix <new prefix>\nsetbotprefix <new prefix> all (main owner only)\nPrefix must be 1-' + MAX_PREFIX_LENGTH + ' characters with no spaces.'));
        return;
    }

    if (scopeAll) {
        if (!senderIsSuperOwner) {
            await reply(sock, jid, msg, box('SET BOT PREFIX', 'Only the main owner can change the prefix for all bots.'));
            return;
        }
        global.setAllBotPrefixValue(newPrefix);
        await reply(sock, jid, msg, box('SET BOT PREFIX', 'Prefix "' + newPrefix + '" set for all bots.'));
        return;
    }

    if (!senderIsOwner) {
        await reply(sock, jid, msg, box('SET BOT PREFIX', notOwnerMsg()));
        return;
    }

    global.setBotPrefixValue(botNumber, newPrefix);
    await reply(sock, jid, msg, box('SET BOT PREFIX', 'Prefix "' + newPrefix + '" set for this bot.'));
}

async function handleRestartBotPrefixCommand(sock, jid, msg, params, botNumber, senderIsOwner, senderIsSuperOwner) {
    const scopeAll = (params[0] || '').toLowerCase() === 'all';

    if (scopeAll) {
        if (!senderIsSuperOwner) {
            await reply(sock, jid, msg, box('RESTART PREFIX', 'Only the main owner can reset the prefix for all bots.'));
            return;
        }
        global.db.prefix.defaultValue = '.';
        global.db.prefix.defaultEnabled = true;
        global.db.prefix.perBot = {};
        global.savePrefix();
        await reply(sock, jid, msg, box('RESTART PREFIX', 'All bots prefix reverted back to the original (default) state.'));
        return;
    }

    if (!senderIsOwner) {
        await reply(sock, jid, msg, box('RESTART PREFIX', notOwnerMsg()));
        return;
    }

    if (global.db.prefix.perBot && global.db.prefix.perBot[botNumber]) {
        delete global.db.prefix.perBot[botNumber];
        global.savePrefix();
    }
    await reply(sock, jid, msg, box('RESTART PREFIX', 'This bot prefix reverted back to the original (default) state.'));
}

async function handleToggleBotPrefixCommand(sock, jid, msg, params, botNumber, senderIsOwner, senderIsSuperOwner) {
    const state = (params[0] || '').toLowerCase();
    const scopeAll = (params[1] || '').toLowerCase() === 'all';

    if (state !== 'on' && state !== 'off') {
        await reply(sock, jid, msg, box('PREFIX', 'Correct usage: prefix on or prefix off'));
        return;
    }

    const enabled = state === 'on';

    if (scopeAll) {
        if (!senderIsSuperOwner) {
            await reply(sock, jid, msg, box('PREFIX', 'Only the main owner can turn the prefix on/off for all bots.'));
            return;
        }
        global.setAllBotPrefixEnabled(enabled);
        await reply(sock, jid, msg, box('PREFIX', 'Prefix turned ' + state.toUpperCase() + ' for all bots.'));
        return;
    }

    if (!senderIsOwner) {
        await reply(sock, jid, msg, box('PREFIX', notOwnerMsg()));
        return;
    }

    global.setBotPrefixEnabled(botNumber, enabled);
    await reply(sock, jid, msg, box('PREFIX', 'Prefix turned ' + state.toUpperCase() + ' for this bot.'));
}

async function handleBotCustomCommand(sock, jid, msg, command, params, botNumber, senderIsOwner, senderIsSuperOwner) {
    switch (command) {
        case 'setbotpp':
            await handleSetBotMediaCommand(sock, jid, msg, 'pp', botNumber, senderIsOwner);
            return true;

        case 'restartpp':
            await handleRestartMediaCommand(sock, jid, msg, 'pp', botNumber, senderIsOwner);
            return true;

        case 'botpp':
            await handleToggleMediaCommand(sock, jid, msg, 'pp', params, botNumber, senderIsOwner);
            return true;

        case 'setbotvoice':
            await handleSetBotMediaCommand(sock, jid, msg, 'voice', botNumber, senderIsOwner);
            return true;

        case 'restartvoice':
        case 'restartboice':
            await handleRestartMediaCommand(sock, jid, msg, 'voice', botNumber, senderIsOwner);
            return true;

        case 'botvoice':
            await handleToggleMediaCommand(sock, jid, msg, 'voice', params, botNumber, senderIsOwner);
            return true;

        case 'setbotname':
            await handleSetBotTextCommand(sock, jid, msg, 'name', botNumber, senderIsOwner);
            return true;

        case 'restartname':
            await handleRestartTextCommand(sock, jid, msg, 'name', botNumber, senderIsOwner);
            return true;

        case 'botname':
            await handleToggleTextCommand(sock, jid, msg, 'name', params, botNumber, senderIsOwner);
            return true;

        case 'setbotverssion':
            await handleSetBotTextCommand(sock, jid, msg, 'version', botNumber, senderIsOwner);
            return true;

        case 'restartverssion':
            await handleRestartTextCommand(sock, jid, msg, 'version', botNumber, senderIsOwner);
            return true;

        case 'botverssion':
            await handleToggleTextCommand(sock, jid, msg, 'version', params, botNumber, senderIsOwner);
            return true;

        case 'setbotprefix':
            await handleSetBotPrefixCommand(sock, jid, msg, params, botNumber, senderIsOwner, senderIsSuperOwner);
            return true;

        case 'restartprefix':
            await handleRestartBotPrefixCommand(sock, jid, msg, params, botNumber, senderIsOwner, senderIsSuperOwner);
            return true;

        case 'botprefix': {
            const prefixState = (params[0] || '').toLowerCase();
            if (prefixState === 'on' || prefixState === 'off') {
                await handleToggleBotPrefixCommand(sock, jid, msg, params, botNumber, senderIsOwner, senderIsSuperOwner);
                return true;
            }
            return false;
        }

        default:
            return false;
    }
}

module.exports = {
    handleBotCustomCommand,
    BOTCUSTOM_COMMANDS
};
