const { reply, box, replyPairCode } = require('../../helper');
const pairSystem = require('../../pair');

const PAIR_COMMANDS = ['addpair', 'delpair', 'listpair', 'clearpair'];

async function handlePairsCommand(sock, jid, msg, command, params, senderNumber, canManagePairs, senderIsSuperOwner) {
    switch (command) {
        case 'addpair': {
            const target = params[0];
            if (!target) {
                pairSystem.setPendingNumberRequest(jid);
                await reply(sock, jid, msg, box('ADD PAIR', 'Please send the phone number with country code that you want to link, for example 923001234567.'));
                break;
            }
            const result = await pairSystem.addPair(target, jid, sock, senderNumber, senderIsSuperOwner);
            if (result.error) {
                await reply(sock, jid, msg, box('ADD PAIR', result.error));
            } else if (result.code) {
                await replyPairCode(sock, jid, msg, result.number, result.code);
            } else {
                await reply(sock, jid, msg, box('ADD PAIR', 'Number +' + result.number + ' is already linked.'));
            }
            break;
        }

        case 'delpair': {
            const senderHasOwnPairs = pairSystem.listPairs(senderNumber, false).length > 0;
            if (!canManagePairs && !senderHasOwnPairs) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'You need to connect a number first using addpair before you can use this command.'));
                break;
            }
            const target = params[0];
            if (!target) {
                await reply(sock, jid, msg, box('DEL PAIR', 'Please provide the number you want to remove.'));
                break;
            }
            const result = await pairSystem.delPair(target, senderNumber, senderIsSuperOwner);
            if (result.error) {
                await reply(sock, jid, msg, box('DEL PAIR', result.error));
            } else {
                await reply(sock, jid, msg, box('DEL PAIR', '+' + result.number + ' has been removed and disconnected.'));
            }
            break;
        }

        case 'listpair': {
            const senderHasOwnPairs = pairSystem.listPairs(senderNumber, false).length > 0;
            if (!canManagePairs && !senderHasOwnPairs) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'You need to connect a number first using addpair before you can use this command.'));
                break;
            }
            const pairs = pairSystem.listPairs(senderNumber, senderIsSuperOwner);
            let body = pairs.length ? pairs.map(p => '+' + p.number + ' - ' + p.status).join('\n') : 'No linked numbers found.';
            if (!senderIsSuperOwner) {
                body = '+' + senderNumber + ' - your number\n' + body;
            }
            await reply(sock, jid, msg, box('LINKED NUMBERS', body));
            break;
        }

        case 'clearpair': {
            const senderHasOwnPairs = pairSystem.listPairs(senderNumber, false).length > 0;
            if (!canManagePairs && !senderHasOwnPairs) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'You need to connect a number first using addpair before you can use this command.'));
                break;
            }
            const count = await pairSystem.clearPairs(senderNumber, senderIsSuperOwner);
            await reply(sock, jid, msg, box('CLEAR PAIR', 'Removed ' + count + ' linked number(s).'));
            break;
        }
    }
}

module.exports = { handlePairsCommand, PAIR_COMMANDS };

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});