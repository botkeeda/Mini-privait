import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { bandah } from '../command.js';
import config from '../config.js';
import os from 'os';
import path from 'path';
import axios from 'axios';

// ======================================================
// CONSTANTS
// ======================================================

const ALIVE_IMG =
    config.BOT_IMAGE || `https://bandaheali-cdn.koyeb.app/bandaheali/smd.jpg`;

let botStartTime = Date.now();

// ======================================================
// FONT SYSTEM (Small Caps)
// ======================================================

const smallCapsMap = {
    'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ғ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ',
    'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ',
    's': 's', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ',
    'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ', 'F': 'ғ', 'G': 'ɢ', 'H': 'ʜ', 'I': 'ɪ',
    'J': 'ᴊ', 'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ', 'N': 'ɴ', 'O': 'ᴏ', 'P': 'ᴘ', 'Q': 'ǫ', 'R': 'ʀ',
    'S': 's', 'T': 'ᴛ', 'U': 'ᴜ', 'V': 'ᴠ', 'W': 'ᴡ', 'X': 'x', 'Y': 'ʏ', 'Z': 'ᴢ'
};

function toSmallCaps(txt) {
    if (!txt || typeof txt !== "string") return "";
    return txt.split("").map((c) => smallCapsMap[c] || c).join("");
}

// ======================================================
// DJ / FAKE QUOTED OBJECT
// ======================================================

function createDJObject(m, customName = null) {
    return {
        key: {
            fromMe: false,
            participant: `0@s.whatsapp.net`,
            remoteJid: "status@broadcast",
        },
        message: {
            contactMessage: {
                displayName: customName || config.BOT_NAME,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${config.BOT_NAME};;;\nFN:${config.BOT_NAME}\nitem1.TEL;waid=${m.sender.split("@")[0]}:${m.sender.split("@")[0]}\nitem1.X-ABLabel:Bandaheali\nEND:VCARD`,
            },
        },
    };
}

// ======================================================
// ALIVE
// ======================================================

bandah(
    {
        pattern: "alive",
        alias: ["live"],
        desc: "Alive status with audio + external ad",
        category: "main",
        react: "🕋",
        filename: __filename,
    },
    async (conn, mek, m, { from, userConfig }) => {
        try {
            const botConfig = userConfig || {};
            const botname = botConfig.BOT_NAME || "SMD-MINI";

            const runtimeMs = Date.now() - botStartTime;
            const days = Math.floor(runtimeMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((runtimeMs / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((runtimeMs / (1000 * 60)) % 60);
            const seconds = Math.floor((runtimeMs / 1000) % 60);
            const uptime = `${days} days ${hours} hours ${minutes} minutes ${seconds} seconds`;

            const audioUrl = "https://bandaheali-cdn.koyeb.app/bandaheali/alive.mp3";
            const thumbUrl = "https://bandaheali-cdn.koyeb.app/media/bot_1767321466701.jpg";

            await conn.sendMessage(
                from,
                {
                    audio: { url: audioUrl },
                    mimetype: "audio/mpeg",
                    ptt: false,
                    contextInfo: {
                        mentionedJid: [m.sender],
                        forwardingScore: 999,
                        isForwarded: true,
                        externalAdReply: {
                            title: "🕋 Recite Durood Shareef",
                            body: `⚡ ${toSmallCaps(uptime)}`,
                            mediaType: 1,
                            thumbnailUrl: thumbUrl,
                            sourceUrl: config.REPO || "https://github.com/iTx-Sarkar",
                            showAdAttribution: true,
                            renderLargerThumbnail: true,
                        },
                    },
                },
                { quoted: mek },
            );
        } catch (err) {
            console.error("❌ Alive cmd error:", err);
        }
    },
);

// ======================================================
// UP / UPTIME
// ======================================================

bandah(
    {
        pattern: "up",
        alias: ["uptime"],
        use: ".up",
        desc: "Show bot uptime (one-line)",
        category: "system",
        filename: __filename,
    },
    async (conn, mek, m, { reply, userConfig }) => {
        try {
            const botConfig = userConfig || {};
            const botname = botConfig.BOT_NAME || "SMD-MINI";

            await m.react("⏳");

            const t = process.uptime();
            const d = Math.floor(t / 86400);
            const h = Math.floor((t % 86400) / 3600);
            const min = Math.floor((t % 3600) / 60);
            const s = Math.floor(t % 60);

            await reply(`⚡ _${toSmallCaps(botname)}_ ➜ ${d}ᴅ ${h}ʜ ${min}ᴍ ${s}ˢ`);
            await m.react("✅");
        } catch (e) {
            await reply(`❌ 𝑼𝒑𝒕𝒊𝒎𝒆 𝒏𝒐𝒕 𝒂𝒗𝒂𝒊𝒍𝒂𝒃𝒍𝒆.${e.message}`);
        }
    },
);

// ======================================================
// ALIVE 2
// ======================================================

bandah(
    {
        pattern: "alive2",
        alias: ["status2", "online2"],
        desc: "Check bot is alive or not",
        category: "main",
        react: "⚡",
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, userConfig }) => {
        try {
            const botConfig = userConfig || {};
            const botname = botConfig.BOT_NAME || "SMD-MINI";
            const menuimg = botConfig.MENU_IMG || ALIVE_IMG;
            const caption = botConfig.CAPTION || "POWERED BY TEAM-BANDAHEALI";

            const thumbnailRes = await axios.get(menuimg, {
                responseType: "arraybuffer"
            });
            const thumbnailBuffer = Buffer.from(thumbnailRes.data, "binary");

            await conn.sendMessage(
                from,
                {
                    contextInfo: {
                        forwardingScore: 999,
                        isForwarded: true,
                        externalAdReply: {
                            title: `${toSmallCaps(botname)} IS ONLINE`,
                            body: `${toSmallCaps(caption)}`,
                            mediaType: 1,
                            renderLargerThumbnail: false,
                            thumbnail: thumbnailBuffer,
                            mediaUrl: menuimg,
                            sourceUrl: "https://wa.me/message/TEWHI2YV6JZKI1",
                            showAdAttribution: true,
                        },
                    },
                },
                { quoted: createDJObject(m, botConfig.OWNER_NAME) },
            );
        } catch (e) {
            console.error("Alive Error:", e);
            reply(`An error occurred: ${e.message}`);
        }
    },
);

// ======================================================
// PING
// ======================================================

bandah(
    {
        pattern: "ping",
        alias: ["speed", "pong"],
        use: ".ping",
        desc: "Check bot's response time.",
        category: "main",
        react: "⚡",
        filename: __filename,
    },
    async (conn, mek, m, { from, sender, reply, userConfig }) => {
        try {
            const botConfig = userConfig || {};
            const botname = botConfig.BOT_NAME || "SMD-MINI";

            const start = new Date().getTime();

            const reactionEmojis = ["🔥", "⚡", "🚀", "💨", "🎯", "🎉", "🌟", "💥", "🕐", "🔹"];
            const textEmojis = ["💎", "🏆", "⚡️", "🚀", "🎶", "🌠", "🌀", "🔱", "🛡️", "✨"];

            const reactionEmoji = reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
            let textEmoji = textEmojis[Math.floor(Math.random() * textEmojis.length)];

            while (textEmoji === reactionEmoji) {
                textEmoji = textEmojis[Math.floor(Math.random() * textEmojis.length)];
            }

            await conn.sendMessage(from, { react: { text: reactionEmoji, key: mek.key } });

            const end = new Date().getTime();
            const responseTime = (end - start) / 1000;

            const text = `\`\`\`𝐏๏፝֟ƞ̽g ${responseTime.toFixed(2)}𝐌s ${textEmoji}\`\`\``;

            await conn.sendMessage(
                from,
                {
                    text,
                    contextInfo: {
                        mentionedJid: [sender],
                        forwardingScore: 999,
                        isForwarded: true,
                    },
                },
                { quoted: createDJObject(m) },
            );
        } catch (e) {
            console.error("Error in ping command:", e);
            reply(`An error occurred: ${e.message}`);
        }
    },
);

// ======================================================
// CHILD / CHID — Extract newsletterJid from channel link
// Usage: .chid <whatsapp channel link>
// Example: .chid https://whatsapp.com/channel/0029VaXXXXXXXXXXXXXX
// ======================================================

bandah(
    {
        pattern: "chid",
        alias: ["child", "channelid", "chjid"],
        desc: "Extract newsletterJid from a WhatsApp channel link",
        category: "tools",
        react: "📡",
        filename: __filename,
    },
    async (conn, mek, m, { from, args, reply, Reply }) => {
        try {
            const input = (args[0] || "").trim();

            if (!input) {
                return reply(
                    `📡 *Channel JID Extractor*\n\n` +
                    `Usage: *.chid <channel link>*\n` +
                    `Example: *.chid https://whatsapp.com/channel/0029VaXXXXXXXXXXXXXXXX*`
                );
            }

            // Extract invite code from URL
            const match = input.match(/channel\/([A-Za-z0-9]+)/);
            const inviteCode = match ? match[1] : input;

            if (!inviteCode || inviteCode.length < 10) {
                return reply("❌ Invalid channel link or invite code.");
            }

            await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

            // Baileys newsletterMetadata (v6.6+)
            if (typeof conn.newsletterMetadata !== "function") {
                return reply("❌ Your Baileys version does not support newsletterMetadata. Please upgrade.");
            }

            const meta = await conn.newsletterMetadata("invite", inviteCode);

            if (!meta) {
                return reply("❌ Could not fetch channel metadata. Link may be invalid or expired.");
            }

            const jid = meta.id || meta.jid || "N/A";
            const name = meta.name || "Unknown";
            const subscribers = meta.subscriberCount || meta.subscribers || "N/A";
            const description = meta.description || "N/A";

            const text =
                `╭━━━❰ *📡 CHANNEL INFO* ❱━━━╮\n` +
                `┃ 📛 *Name:* ${name}\n` +
                `┃ 🆔 *JID:* \n┃ ${jid}\n` +
                `┃ 👥 *Subscribers:* ${subscribers}\n` +
                `┃ 📝 *Description:* \n┃ ${description}\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━╯`;

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

            await conn.sendMessage(
                from,
                {
                    text,
                    contextInfo: {
                        mentionedJid: [m.sender],
                        forwardingScore: 999,
                        isForwarded: true,
                    },
                },
                { quoted: mek },
            );
            
            await Reply(jid);
            

        } catch (err) {
            console.error("[chid] error:", err);
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
            reply(`❌ Error: ${err.message}`);
        }
    },
);
