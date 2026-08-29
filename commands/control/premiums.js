const { reply, box, addPremiumEntry, removePremiumEntry, listPremiumEntries, clearPremiumEntries } = require('../../helper');

const PREMIUM_COMMANDS = ['addpremium', 'delpremium', 'listpremium', 'clearpremium'];

async function handlePremiumsCommand(sock, jid, msg, command, params, senderNumber, senderIsSuperOwner, senderIsPremium) {
    switch (command) {
        case 'addpremium': {
            if (!senderIsSuperOwner && !senderIsPremium) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the owner or premium can use this command.'));
                break;
            }
            const target = (params[0] || '').replace(/[^0-9]/g, '');
            if (!target) {
                await reply(sock, jid, msg, box('ADD PREMIUM', 'Please provide a valid number.'));
                break;
            }
            const addResult = addPremiumEntry(target, senderNumber);
            if (addResult.error === 'exists') {
                await reply(sock, jid, msg, box('ADD PREMIUM', '+' + target + ' is already premium.'));
            } else {
                await reply(sock, jid, msg, box('ADD PREMIUM', '+' + target + ' has been added as premium.'));
            }
            break;
        }

        case 'delpremium': {
            if (!senderIsSuperOwner && !senderIsPremium) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the owner or premium can use this command.'));
                break;
            }
            const target = (params[0] || '').replace(/[^0-9]/g, '');
            const delResult = removePremiumEntry(target, senderNumber, senderIsSuperOwner);
            if (delResult.error === 'not_found') {
                await reply(sock, jid, msg, box('DEL PREMIUM', 'This number is not in the premium list.'));
            } else if (delResult.error === 'forbidden') {
                await reply(sock, jid, msg, box('DEL PREMIUM', 'You can only remove premium users that you added yourself.'));
            } else {
                await reply(sock, jid, msg, box('DEL PREMIUM', '+' + target + ' has been removed from premium.'));
            }
            break;
        }

        case 'listpremium': {
            if (!senderIsSuperOwner && !senderIsPremium) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the owner or premium can use this command.'));
                break;
            }
            const bypassScope = senderIsSuperOwner;
            const addedPremium = listPremiumEntries(senderNumber, bypassScope);
            const lines = [];
            if (addedPremium.length) {
                lines.push(bypassScope ? '*Premium (addpremium):*' : '*Your Added Premium Users:*');
                addedPremium.forEach(e => lines.push('+' + e.number));
            }
            if (bypassScope) {
                const githubOwners = global.ownerNumbers || [];
                const addedOwners = global.db.owners || [];
                const mainNumber = global.mainBotNumber ? [global.mainBotNumber] : [];
                if (githubOwners.length) {
                    if (lines.length) lines.push('');
                    lines.push('*Permanent Owners:*');
                    githubOwners.forEach(n => lines.push('+' + n));
                }
                if (addedOwners.length) {
                    if (lines.length) lines.push('');
                    lines.push('*Added Owners (addowner):*');
                    addedOwners.forEach(e => lines.push('+' + e.number));
                }
                if (mainNumber.length && !githubOwners.includes(mainNumber[0])) {
                    if (lines.length) lines.push('');
                    lines.push('*Main Connected Number:*');
                    lines.push('+' + mainNumber[0]);
                }
            }
            if (!lines.length) lines.push('No premium users found.');
            await reply(sock, jid, msg, box('PREMIUM LIST', lines.join('\n')));
            break;
        }

        case 'clearpremium': {
            if (!senderIsSuperOwner && !senderIsPremium) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the owner or premium can use this command.'));
                break;
            }
            const bypassScope = senderIsSuperOwner;
            const count = clearPremiumEntries(senderNumber, bypassScope);
            const scopeText = bypassScope ? 'added via addpremium have' : 'added by you have';
            await reply(sock, jid, msg, box('CLEAR PREMIUM', count + ' premium user(s) ' + scopeText + ' been removed.'));
            break;
        }
    }
}

module.exports = { handlePremiumsCommand, PREMIUM_COMMANDS };

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});