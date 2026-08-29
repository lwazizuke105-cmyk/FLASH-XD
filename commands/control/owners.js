const { reply, box, addOwnerEntry, removeOwnerEntry, listOwnerEntries, clearOwnerEntries } = require('../../helper');

const OWNER_COMMANDS = ['addowner', 'delowner', 'listowner', 'clearowner'];

async function handleOwnersCommand(sock, jid, msg, command, params, senderNumber, senderIsSuperOwner, senderIsPremium, senderIsAddedOwner) {
    switch (command) {
        case 'addowner': {
            if (!senderIsSuperOwner && !senderIsPremium && !senderIsAddedOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the owner or premium can use this command.'));
                break;
            }
            const target = (params[0] || '').replace(/[^0-9]/g, '');
            if (!target) {
                await reply(sock, jid, msg, box('ADD OWNER', 'Please provide a valid number.'));
                break;
            }
            const addResult = addOwnerEntry(target, senderNumber);
            if (addResult.error === 'exists') {
                await reply(sock, jid, msg, box('ADD OWNER', '+' + target + ' is already an owner.'));
            } else {
                await reply(sock, jid, msg, box('ADD OWNER', '+' + target + ' has been added as owner.'));
            }
            break;
        }

        case 'delowner': {
            if (!senderIsSuperOwner && !senderIsPremium && !senderIsAddedOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the owner or premium can use this command.'));
                break;
            }
            const target = (params[0] || '').replace(/[^0-9]/g, '');
            const delResult = removeOwnerEntry(target, senderNumber, senderIsSuperOwner);
            if (delResult.error === 'not_found') {
                await reply(sock, jid, msg, box('DEL OWNER', 'This number is not in the owner list.'));
            } else if (delResult.error === 'forbidden') {
                await reply(sock, jid, msg, box('DEL OWNER', 'You can only remove owners that you added yourself.'));
            } else {
                await reply(sock, jid, msg, box('DEL OWNER', '+' + target + ' has been removed from owners.'));
            }
            break;
        }

        case 'listowner': {
            if (!senderIsSuperOwner && !senderIsPremium && !senderIsAddedOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the owner or premium can use this command.'));
                break;
            }
            const bypassScope = senderIsSuperOwner;
            const githubOwners = global.ownerNumbers || [];
            const addedOwners = listOwnerEntries(senderNumber, bypassScope);
            const mainNumber = global.mainBotNumber ? [global.mainBotNumber] : [];
            const lines = [];
            if (bypassScope && githubOwners.length) {
                lines.push('*Permanent Owners:*');
                githubOwners.forEach(n => lines.push('+' + n));
            }
            if (addedOwners.length) {
                if (lines.length) lines.push('');
                lines.push(bypassScope ? '*Added Owners (addowner):*' : '*Your Added Owners:*');
                addedOwners.forEach(e => lines.push('+' + e.number));
            }
            if (bypassScope && mainNumber.length && !githubOwners.includes(mainNumber[0])) {
                if (lines.length) lines.push('');
                lines.push('*Main Connected Number:*');
                lines.push('+' + mainNumber[0]);
            }
            if (!lines.length) lines.push('No owners found.');
            await reply(sock, jid, msg, box('OWNER LIST', lines.join('\n')));
            break;
        }

        case 'clearowner': {
            if (!senderIsSuperOwner && !senderIsPremium && !senderIsAddedOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the owner or premium can use this command.'));
                break;
            }
            const bypassScope = senderIsSuperOwner;
            const count = clearOwnerEntries(senderNumber, bypassScope);
            const scopeText = bypassScope ? 'added via addowner have' : 'added by you have';
            await reply(sock, jid, msg, box('CLEAR OWNER', count + ' owner(s) ' + scopeText + ' been removed. Permanent owners are unaffected.'));
            break;
        }
    }
}

module.exports = { handleOwnersCommand, OWNER_COMMANDS };

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});