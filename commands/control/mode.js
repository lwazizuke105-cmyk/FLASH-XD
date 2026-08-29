const { reply, box } = require('../../helper');
const pairSystem = require('../../pair');
const MODE_COMMANDS = ['self', 'public'];

async function handleModeCommand(sock, jid, msg, command, botNumber, isSessionSelf, senderIsOwner) {
    switch (command) {
        case 'self': {
            if (!isSessionSelf) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the owner can use this command.'));
                break;
            }
            if (senderIsOwner) {
                const allNumbers = [botNumber, global.mainBotNumber, ...pairSystem.getAllPairedNumbers()].filter(Boolean);
                global.setBotSelfMode(allNumbers, true);
                await reply(sock, jid, msg, box('MODE CHANGED', 'All bots are now in self mode. Only the owner can use commands.'));
            } else {
                global.setBotSelfMode([botNumber], true);
                await reply(sock, jid, msg, box('MODE CHANGED', 'This bot is now in self mode. Only its owner can use commands.'));
            }
            break;
        }

        case 'public': {
            if (!isSessionSelf) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the owner can use this command.'));
                break;
            }
            if (senderIsOwner) {
                const allNumbers = [botNumber, global.mainBotNumber, ...pairSystem.getAllPairedNumbers()].filter(Boolean);
                global.setBotSelfMode(allNumbers, false);
                await reply(sock, jid, msg, box('MODE CHANGED', 'All bots are now in public mode. Everyone can use commands.'));
            } else {
                global.setBotSelfMode([botNumber], false);
                await reply(sock, jid, msg, box('MODE CHANGED', 'This bot is now in public mode. Everyone can use commands.'));
            }
            break;
        }
    }
}

module.exports = { handleModeCommand, MODE_COMMANDS };

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});