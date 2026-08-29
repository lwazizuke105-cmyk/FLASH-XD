const { reply, box, downloadQuotedMedia, getQuotedText } = require('../../helper');

function hasQuotedContent(msg) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (!ctx || !ctx.quotedMessage) return false;
    const q = ctx.quotedMessage;
    return !!(q.imageMessage || q.videoMessage || q.conversation || q.extendedTextMessage);
}

const GCSTATUS_COMMANDS = ['gcstatus'];

async function handleGcstatusCommand(sock, jid, msg, command, params, sender, senderIsOwner) {
    switch (command) {
        case 'gcstatus': {
            if (!senderIsOwner) {
                await reply(sock, jid, msg, box('ACCESS DENIED', 'Only the bot owner can broadcast to all groups.'));
                break;
            }

            if (!hasQuotedContent(msg)) {
                await reply(sock, jid, msg, box('GCSTATUS', 'Reply to a text, image or video message with .gcstatus to post it as the group status in every group.'));
                break;
            }

            const quoted = await downloadQuotedMedia(msg);
            if (!quoted) {
                await reply(sock, jid, msg, box('GCSTATUS', 'Failed to read the replied message.'));
                break;
            }

            const caption = getQuotedText(msg) || '';

            let content = null;
            if (quoted.type === 'image') content = { groupStatusMessage: { image: quoted.buffer, caption } };
            else if (quoted.type === 'video') content = { groupStatusMessage: { video: quoted.buffer, caption } };
            else if (quoted.type === 'text') content = { groupStatusMessage: { text: caption } };

            if (!content) {
                await reply(sock, jid, msg, box('GCSTATUS', 'Only text, image or video messages can be posted as a group status.'));
                break;
            }

            let groups = [];
            try {
                const participating = await sock.groupFetchAllParticipating();
                groups = Object.values(participating || {});
            } catch (e) {
                await reply(sock, jid, msg, box('GCSTATUS', 'Failed to fetch groups: ' + e.message));
                break;
            }

            let sent = 0;
            let failed = 0;

            for (const g of groups) {
                try {
                    await sock.sendMessage(g.id, content);
                    sent++;
                } catch (e) {
                    failed++;
                }
            }

            await reply(sock, jid, msg, box('GCSTATUS', `Group status posted.\nSent: ${sent}\nFailed: ${failed}\nTotal groups: ${groups.length}`));
            break;
        }
    }
}

module.exports = {
    handleGcstatusCommand,
    GCSTATUS_COMMANDS
};

require('fs').watchFile(require.resolve(__filename), { interval: 500 }, () => {
  require('fs').unwatchFile(require.resolve(__filename));
  delete require.cache[require.resolve(__filename)];
  require(__filename);
});
