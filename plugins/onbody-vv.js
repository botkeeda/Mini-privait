import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { cmd } from '../command.js';
import fs from 'fs';
import path from 'path';

function normalize(text) {
    return text.toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

const triggerWords = ["beautiful", "cute", "oh", "🙂", "nice", "ok", "❤️", "😘", "❤", "😍", "🔥", "😁", "wow", "👍", "send me", "sendme", "save"];

cmd({
  on: "body",
  dontAddCommandList: true,
  filename: __filename
}, async (client, message, match, { from, body, isCreator }) => {
  try {
    if (!triggerWords.includes(body?.toLowerCase?.() || body)) return;
    if (!isCreator) return;
    if (!message.quoted) return;
    
    const buffer = await message.quoted.download();
    const mtype = message.quoted.mtype;

    let messageContent = {};
    if (mtype === "imageMessage") {
      messageContent = { image: buffer, caption: message.quoted.text || '', mimetype: "image/jpeg" };
    } else if (mtype === "videoMessage") {
      messageContent = { video: buffer, caption: message.quoted.text || '', mimetype: "video/mp4" };
    } else if (mtype === "audioMessage") {
      messageContent = { audio: buffer, mimetype: "audio/mp4", ptt: message.quoted.ptt || false };
    } else {
      return;
    }
    await client.sendMessage(message.sender, messageContent, { quoted: message });
  } catch (error) {}
});

cmd({
    pattern: "vv",
    alias: ["vv2", "wah", "ohh", "oho", "🙂", "nice", "ok"],
    desc: "Retrieve quoted view once message",
    category: "owner",
    react: "👀",
    filename: __filename
},
async (conn, mek, m, { from, reply, isDev, isMe }) => {
    try {
        if (!isMe && !isDev) return;
        const quoted = m.quoted || mek.quoted;
        if (!quoted) return await reply("❌ Reply to a view once message.");
        
        const mtype = quoted.mtype || "";
        const msg = quoted.message || {};
        const buffer = await quoted.download();
        if (!buffer) return reply("❌ Failed to download media.");

        const textMsg = quoted.text || quoted.caption || quoted.message?.imageMessage?.caption || quoted.message?.videoMessage?.caption || quoted.message?.extendedTextMessage?.text || quoted.body || "";
        let content = {};

        if (mtype === "imageMessage") {
            content = { image: buffer, caption: textMsg || "", mimetype: msg.imageMessage?.mimetype || "image/jpeg" };
        } else if (mtype === "videoMessage") {
            content = { video: buffer, caption: textMsg || "", mimetype: msg.videoMessage?.mimetype || "video/mp4" };
        } else if (mtype === "audioMessage") {
            content = { audio: buffer, mimetype: msg.audioMessage?.mimetype || "audio/ogg; codecs=opus", ptt: msg.audioMessage?.ptt || false };
        } else {
            return await reply("❌ Only image, video, and audio messages are supported.");
        }

        await conn.sendMessage(from, content, { quoted: mek });
    } catch (error) {
        console.error("VV CMD ERROR:", error);
        await reply("❌ Error fetching vv message:\n" + error.message);
    }
});

cmd({ on: "body" }, async (conn, mek, m, { from, body, isMe, isDev, userConfig }) => {
    try {
        if (from.endsWith('@g.us')) return; // Disable in groups
        if (userConfig?.AUTO_REPLY !== "true" && userConfig?.AUTO_REPLY !== true) return;
        if (isMe || isDev || !body) return;
        
        const filePath = path.join(__dirname, '../lib/autoreply.json');
        if (!fs.existsSync(filePath)) return;

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const msg = normalize(body);
        
        for (const key in data) {
            if (msg === normalize(key)) {
                await conn.sendMessage(from, { text: data[key] }, { quoted: mek });
                break;
            }
        }
    } catch (err) {
        console.error("AUTO_REPLY ERROR:", err);
    }
});

cmd({ on: "body" }, async (conn, mek, m, { from, body, isMe, isDev, userConfig }) => {
    try {
        if (from.endsWith('@g.us')) return; // Disable in groups
        if (userConfig?.AUTO_STICKER !== "true" && userConfig?.AUTO_STICKER !== true) return;
        if (isMe || isDev || !body) return;
        
        const filePath = path.join(__dirname, '../lib/sticker.json');
        if (!fs.existsSync(filePath)) return;

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const msg = normalize(body);
        
        for (const key in data) {
            if (msg === normalize(key)) {
                const stickerPath = path.join(__dirname, '../lib/sticker/', data[key]);
                if (!fs.existsSync(stickerPath)) {
                    console.error(`Sticker file not found: ${stickerPath}`);
                    return;
                }

                const buffer = fs.readFileSync(stickerPath);
                await conn.sendMessage(from, { sticker: buffer }, { quoted: mek });
                break;
            }
        }
    } catch (err) {
        console.error("AUTO_STICKER ERROR:", err);
    }
});