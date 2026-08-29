const { reply, box } = require('../../helper');

function toFontChars(text, base) {
    let result = '';
    for (const ch of text) {
        const code = ch.charCodeAt(0);
        if (code >= 65 && code <= 90) {
            result += String.fromCodePoint(base.upper + (code - 65));
        } else if (code >= 97 && code <= 122) {
            result += String.fromCodePoint(base.lower + (code - 97));
        } else if (code >= 48 && code <= 57 && base.digit) {
            result += String.fromCodePoint(base.digit + (code - 48));
        } else {
            result += ch;
        }
    }
    return result;
}

const FONTS = {
    bold: { upper: 0x1D400, lower: 0x1D41A, digit: 0x1D7CE },
    italic: { upper: 0x1D434, lower: 0x1D44E, digit: null },
    boldItalic: { upper: 0x1D468, lower: 0x1D482, digit: null },
    sans: { upper: 0x1D5A0, lower: 0x1D5BA, digit: 0x1D7E2 },
    monospace: { upper: 0x1D670, lower: 0x1D68A, digit: 0x1D7F6 },
    sansBold: { upper: 0x1D5D4, lower: 0x1D5EE, digit: 0x1D7EC },
    sansBoldItalic: { upper: 0x1D63C, lower: 0x1D656, digit: 0x1D7EC },
    fullwidth: { upper: 0xFF21, lower: 0xFF41, digit: 0xFF10 }
};

function applyFont(text, fontKey) {
    return toFontChars(text, FONTS[fontKey]);
}

const MENU_SECTIONS = [
    { title: 'control commands', items: ['self', 'public', 'botpp on / off', 'setbotpp', 'restartpp', 'botprefix on / off', 'setbotprefix', 'restartprefix', 'botvoice on / off', 'setbotvoice', 'restartvoice', 'botname on / off', 'setbotname', 'restartname', 'botverssion on / off', 'setbotverssion', 'restartverssion', 'menustyle', 'setmenustyle1', 'setmenustyle2', 'setmenustyle3', 'setmenustyle4', 'setmenustyle5', 'setmenustyle6', 'setmenustyle7', 'setmenustyle8', 'setmenustyle9', 'setmenustyle10', 'restartmenustyle'] },
    { title: 'owner commands', items: ['addowner', 'delowner', 'listowner', 'clearowner'] },
    { title: 'premium commands', items: ['addpremium', 'delpremium', 'listpremium', 'clearpremium'] },
    { title: 'pair commands', items: ['addpair', 'delpair', 'listpair', 'clearpair'] },
    {
        title: 'Personal commands',
        groups: [
            { title: 'on / off', items: ['autoseen', 'autoreply', 'alwaysonline', 'autoblockunknown', 'autoblockunknowncalls', 'autotyping', 'autorecording', 'autoreact', 'anticall', 'autoviewonce', 'autosavedeleted', 'autoarchive', 'automute', 'autoblockgroup', 'autogreet', 'autostatuslike', 'autostatusview', 'autostatusdownload'] }
        ]
    }
];

const MENU_STYLES = {
    1: {
        id: 1,
        name: 'Neon Bold',
        font: 'bold',
        top: '╭──────────────⦿',
        bottom: '╰──────────────⦿',
        side: '│',
        divider: '├──────────────⦿',
        subDivider: '├──────',
        bullet: '➤'
    },
    2: {
        id: 2,
        name: 'Royal Italic',
        font: 'italic',
        top: '╔═════════════╗',
        bottom: '╚═════════════╝',
        side: '║',
        divider: '╠═════════════╣',
        subDivider: '╟─────',
        bullet: '♛'
    },
    3: {
        id: 3,
        name: 'Aurora Wave',
        font: 'boldItalic',
        top: '▛▀▀▀▀▀▀▀▀▀▀▀▀▀▜',
        bottom: '▙▄▄▄▄▄▄▄▄▄▄▄▄▄▟',
        side: '▌',
        divider: '▐▬▬▬▬▬▬▬▬▬▬▬▬▬▌',
        subDivider: '▐▬▬▬▬▬',
        bullet: '✦'
    },
    4: {
        id: 4,
        name: 'Sans Line',
        font: 'sans',
        top: '┌─────────────┐',
        bottom: '└─────────────┘',
        side: '│',
        divider: '├─────────────┤',
        subDivider: '├──────',
        bullet: '▸'
    },
    5: {
        id: 5,
        name: 'Mono Dots',
        font: 'monospace',
        top: '• • • • • • • • •',
        bottom: '• • • • • • • • •',
        side: '┆',
        divider: '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄',
        subDivider: '┄┄┄┄┄┄',
        bullet: '◆'
    },
    6: {
        id: 6,
        name: 'Cyber Fullwidth',
        font: 'fullwidth',
        top: '⌈▓▓▓▓▓▓▓▓▓▓▓▓▓⌉',
        bottom: '⌊▓▓▓▓▓▓▓▓▓▓▓▓▓⌋',
        side: '║',
        divider: '⌈▬▬▬▬▬▬▬▬▬▬▬▬▬⌉',
        subDivider: '⌈▬▬▬▬▬',
        bullet: '⟢'
    },
    7: {
        id: 7,
        name: 'Gothic Sans Bold',
        font: 'sansBold',
        top: '╒══════🔱══════╕',
        bottom: '╘══════🔱══════╛',
        side: '│',
        divider: '╞══════════════╡',
        subDivider: '╞═════',
        bullet: '❖'
    },
    8: {
        id: 8,
        name: 'Shadow Pulse',
        font: 'boldItalic',
        top: '⟦⋘═══════════⋙⟧',
        bottom: '⟦⋘═══════════⋙⟧',
        side: '⋮',
        divider: '⟦───────────⟧',
        subDivider: '⟦────',
        bullet: '☍'
    },
    9: {
        id: 9,
        name: 'Diamond Deluxe',
        font: 'sansBoldItalic',
        top: '◆─────────────◆',
        bottom: '◆─────────────◆',
        side: '♢',
        divider: '◇═════════════◇',
        subDivider: '◇─────',
        bullet: '◈'
    },
    10: {
        id: 10,
        name: 'Galaxy Hex',
        font: 'sans',
        top: '⬡⬡⬡⬡⬡⬡⬡⬡⬡⬡⬡⬡⬡',
        bottom: '⬡⬡⬡⬡⬡⬡⬡⬡⬡⬡⬡⬡⬡',
        side: '⟡',
        divider: '⬢⬢⬢⬢⬢⬢⬢⬢⬢⬢⬢⬢⬢',
        subDivider: '⬢⬢⬢⬢⬢',
        bullet: '✧'
    }
};

const DEFAULT_STYLE_ID = 1;

function getStyle(styleId) {
    return MENU_STYLES[styleId] || MENU_STYLES[DEFAULT_STYLE_ID];
}

function buildInfoBlock(style, info) {
    const lines = [style.top];
    lines.push(style.side + ' ' + applyFont('Name', style.font) + ': *' + info.displayName + '*');
    lines.push(style.side + ' ' + applyFont('Version', style.font) + ': *' + info.displayVersion + '*');
    lines.push(style.side + ' ' + applyFont('Mode', style.font) + ': *' + info.mode + '*');
    lines.push(style.side + ' ' + applyFont('Prefix', style.font) + ': *' + info.currentPrefix + '* (' + info.prefixStatus + ')');
    lines.push(style.side + ' ' + applyFont('User', style.font) + ': ' + info.name);
    lines.push(style.side + ' ' + applyFont('Time', style.font) + ': ' + info.time);
    lines.push(style.side + ' ' + applyFont('Style', style.font) + ': ' + style.name);
    lines.push(style.bottom);
    return lines.join('\n');
}

function buildSectionLines(style, pfx, section) {
    const lines = [];
    lines.push(style.top);
    lines.push(style.side + ' ' + style.bullet + ' *' + applyFont(section.title, style.font) + '*');
    lines.push(style.divider);

    if (section.items) {
        section.items.forEach(item => {
            lines.push(style.side + ' ' + style.bullet + ' ' + pfx + item);
        });
    }

    if (section.groups) {
        section.groups.forEach((group, idx) => {
            lines.push(style.side + ' ' + style.bullet + ' *' + applyFont(group.title, style.font) + '*');
            lines.push(style.subDivider);
            group.items.forEach(item => {
                lines.push(style.side + ' ' + style.bullet + ' ' + pfx + item);
            });
            if (idx < section.groups.length - 1) {
                lines.push(style.divider);
            }
        });
    }

    lines.push(style.bottom);
    return lines.join('\n');
}

function buildMenuText(styleId, pfx, info) {
    const style = getStyle(styleId);
    const parts = [buildInfoBlock(style, info)];
    MENU_SECTIONS.forEach(section => {
        parts.push(buildSectionLines(style, pfx, section));
    });
    return parts.join('\n');
}

const MENUSTYLE_COMMANDS = ['setmenustyle1', 'setmenustyle2', 'setmenustyle3', 'setmenustyle4', 'setmenustyle5', 'setmenustyle6', 'setmenustyle7', 'setmenustyle8', 'setmenustyle9', 'setmenustyle10', 'menustyle', 'restartmenustyle'];

function listStylesText() {
    return Object.values(MENU_STYLES).map(s => {
        return s.id + '. ' + s.name;
    }).join('\n');
}

async function handleMenuStyleCommand(sock, jid, msg, command, params, botNumber, senderIsOwner) {
    if (command === 'menustyle') {
        const current = global.getBotMenuStyle(botNumber);
        const style = getStyle(current);
        await reply(sock, jid, msg, box('MENU STYLE', 'Current style: ' + style.name + ' (' + style.id + ')\n\nAvailable styles:\n' + listStylesText() + '\n\nUse setmenustyle1 to setmenustyle10 to change.'));
        return true;
    }

    if (command === 'restartmenustyle') {
        if (!senderIsOwner) {
            await reply(sock, jid, msg, box('MENU STYLE', 'Only the bot owner can use this command.'));
            return true;
        }
        global.resetBotMenuStyle(botNumber);
        await reply(sock, jid, msg, box('MENU STYLE', 'Reverted back to the default menu style.'));
        return true;
    }

    const match = command.match(/^setmenustyle([1-9]|10)$/);
    if (match) {
        if (!senderIsOwner) {
            await reply(sock, jid, msg, box('MENU STYLE', 'Only the bot owner can use this command.'));
            return true;
        }
        const styleId = parseInt(match[1], 10);
        global.setBotMenuStyle(botNumber, styleId);
        const style = getStyle(styleId);
        await reply(sock, jid, msg, box('MENU STYLE', 'Menu style set to: ' + style.name + '\nThis style will now show whenever this bot number displays the menu.'));
        return true;
    }

    return false;
}

module.exports = {
    handleMenuStyleCommand,
    MENUSTYLE_COMMANDS,
    buildMenuText,
    MENU_STYLES,
    DEFAULT_STYLE_ID
};