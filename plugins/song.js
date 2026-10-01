// ======================================================
// plugins/song.js
// Song / Play — YouTube MP3 Downloader (with search)
// ======================================================

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

import { bandah } from '../command.js';
import config from '../config.js';
import axios from 'axios';
import yts from 'yt-search';

// ======================================================
// CONSTANTS
// ======================================================

const YT_API_BASE = "https://bandaheali-apis.netlify.app/api/downloader/ytmp3";
const YT_API_KEY  = "bandaheali";

// Small caps helper (agar aapke paas shared helper hai to import kar lo,
// warna ye inline copy use karo)
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
// HELPERS
// ======================================================

function isYouTubeUrl(input) {
    return /youtu\.?be|youtube\.com/i.test(input || "");
}

// Extract videoId from any YouTube URL form
function extractVideoId(url) {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/,
        /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
        /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
        /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
        /(?:youtube\.com\/live\/)([A-Za-z0-9_-]{11})/
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m && m[1]) return m[1];
    }
    return null;
}

// Normalize any YouTube URL to canonical watch URL
function normalizeYouTubeUrl(url) {
    const id = extractVideoId(url);
    if (id) return `https://www.youtube.com/watch?v=${id}`;
    return url;
}

// Search YouTube with yt-search
async function searchYouTube(query) {
    try {
        const r = await yts(query);
        const video = r?.videos?.[0];
        if (!video) return null;
        return {
            url: video.url,
            title: video.title,
            duration: video.timestamp,
            thumbnail: video.thumbnail,
            author: video.author?.name || "Unknown",
            videoId: video.videoId,
        };
    } catch (e) {
        console.error("[yt-search] error:", e.message);
        return null;
    }
}

// ======================================================
// MAIN HANDLER
// ======================================================

async function handleYouTubeAudio(conn, mek, m, { from, args, reply, userConfig }) {
    try {
        let query = args.join(" ").trim();

        // Reply-to support (agar user ne link pe reply kiya ho)
        if (!query && m.quoted) {
            const q = m.quoted;
            const text =
                q.text ||
                q.body ||
                q.message?.conversation ||
                q.message?.extendedTextMessage?.text ||
                q.msg?.text ||
                "";
            if (text && isYouTubeUrl(text)) query = text.trim();
        }

        if (!query) {
            return reply(
                `🎵 *Usage:*\n` +
                `• *.song <youtube link>*\n` +
                `• *.song <song name>* (search)\n` +
                `• Reply to a YT link with *.song*`
            );
        }

        await conn.sendMessage(from, { react: { text: "🔍", key: mek.key } });

        let targetUrl;
        let metaInfo = null;

        if (isYouTubeUrl(query)) {
            targetUrl = normalizeYouTubeUrl(query);
        } else {
            // Search via yt-search
            const found = await searchYouTube(query);
            if (!found) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ No results found on YouTube.");
            }
            targetUrl = found.url;
            metaInfo = found;
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        // Call download API
        const apiUrl = `${YT_API_BASE}?url=${encodeURIComponent(targetUrl)}&key=${YT_API_KEY}`;
        const res = await axios.get(apiUrl, { timeout: 60000 });

        if (!res.data?.status || !res.data?.result) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Failed to fetch audio from API.");
        }

        const r = res.data.result;

        const audioUrl  = r.audio_url || r.mp3_url || r.audio || r.url;
        const title     = r.title || metaInfo?.title || "Unknown Title";
        const duration  = r.duration || metaInfo?.duration || "N/A";
        const bitrate   = r.bitrate || "128kbps";
        const thumbnail = r.thumbnail || metaInfo?.thumbnail || "";
        const author    = r.author || metaInfo?.author || "Unknown";

        if (!audioUrl) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ No audio URL returned.");
        }

        await conn.sendMessage(from, { react: { text: "⬇️", key: mek.key } });

        const botname = (userConfig?.BOT_NAME) || config.BOT_NAME || "SMD-MINI";

        const caption =
            `🎵 *${toSmallCaps(title)}*\n\n` +
            `┌───────────────────⭓\n` +
            `│ 👤 *Artist:* ${author}\n` +
            `│ ⏱️ *Duration:* ${duration}\n` +
            `│ 🎚️ *Bitrate:* ${bitrate}\n` +
            `└───────────────────⭓\n\n` +
            `> ⚡ Powered By ${toSmallCaps(botname)}`;

        // Send thumbnail preview (optional, nice UX)
        try {
            if (thumbnail) {
                await conn.sendMessage(
                    from,
                    {
                        image: { url: thumbnail },
                        caption,
                        contextInfo: {
                            mentionedJid: [m.sender],
                            forwardingScore: 999,
                            isForwarded: true,
                            externalAdReply: {
                                title: title,
                                body: `${duration} • ${bitrate}`,
                                mediaType: 1,
                                thumbnailUrl: thumbnail,
                                sourceUrl: targetUrl,
                                renderLargerThumbnail: true,
                                showAdAttribution: true,
                            },
                        },
                    },
                    { quoted: mek }
                );
            }
        } catch (_) {}

        // Send audio
        await conn.sendMessage(
            from,
            {
                audio: { url: audioUrl },
                mimetype: "audio/mpeg",
                ptt: false,
                fileName: `${title}.mp3`,
                contextInfo: {
                    mentionedJid: [m.sender],
                    forwardingScore: 999,
                    isForwarded: true,
                    externalAdReply: {
                        title: title,
                        body: `${duration} • ${bitrate}`,
                        mediaType: 1,
                        thumbnailUrl: thumbnail,
                        sourceUrl: targetUrl,
                        renderLargerThumbnail: true,
                        showAdAttribution: true,
                    },
                },
            },
            { quoted: mek }
        );

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (err) {
        console.error("[song/play] error:", err);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }).catch(() => {});
        reply(`❌ Error: ${err.message}`);
    }
}

// ======================================================
// .song
// ======================================================

bandah(
    {
        pattern: "song",
        alias: ["ytmp3", "ytaudio", "music"],
        desc: "Download YouTube audio (MP3)",
        category: "download",
        react: "🎵",
        filename: __filename,
    },
    async (conn, mek, m, ctx) => {
        return handleYouTubeAudio(conn, mek, m, ctx);
    }
);

// ======================================================
// .play
// ======================================================

bandah(
    {
        pattern: "play",
        alias: ["ply", "playsong"],
        desc: "Play / download a song from YouTube",
        category: "download",
        react: "▶️",
        filename: __filename,
    },
    async (conn, mek, m, ctx) => {
        return handleYouTubeAudio(conn, mek, m, ctx);
    }
);