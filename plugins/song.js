// ======================================================
// plugins/song.js
// Song / Play / Video — YouTube MP3 & MP4 Downloader
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

const YT_API_BASE = "https://jawad-tech.vercel.app/download/ytdl";

// ======================================================
// SMALL CAPS
// ======================================================

const smallCapsMap = {
    'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ',
    'f': 'ғ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ',
    'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ',
    'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 's', 't': 'ᴛ',
    'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ',
    'z': 'ᴢ',
    'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ',
    'F': 'ғ', 'G': 'ɢ', 'H': 'ʜ', 'I': 'ɪ', 'J': 'ᴊ',
    'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ', 'N': 'ɴ', 'O': 'ᴏ',
    'P': 'ᴘ', 'Q': 'ǫ', 'R': 'ʀ', 'S': 's', 'T': 'ᴛ',
    'U': 'ᴜ', 'V': 'ᴠ', 'W': 'ᴡ', 'X': 'x', 'Y': 'ʏ',
    'Z': 'ᴢ'
};

function toSmallCaps(txt) {
    if (!txt || typeof txt !== "string") return "";
    return txt.split("").map(c => smallCapsMap[c] || c).join("");
}

// ======================================================
// YOUTUBE HELPERS
// ======================================================

function isYouTubeUrl(input) {
    return /(?:youtube\.com|youtu\.be)/i.test(input || "");
}

function extractVideoId(url) {
    if (!url) return null;

    const patterns = [
        /youtube\.com\/watch\?.*?\bv=([A-Za-z0-9_-]{11})/,
        /youtu\.be\/([A-Za-z0-9_-]{11})/,
        /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
        /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
        /youtube\.com\/live\/([A-Za-z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match?.[1]) return match[1];
    }

    return null;
}

function normalizeYouTubeUrl(url) {
    const id = extractVideoId(url);
    return id
        ? `https://www.youtube.com/watch?v=${id}`
        : url;
}

async function searchYouTube(query) {
    try {
        const result = await yts(query);
        const video = result?.videos?.[0];

        if (!video) return null;

        return {
            url: video.url,
            title: video.title,
            duration: video.timestamp || "N/A",
            thumbnail: video.thumbnail || "",
            author: video.author?.name || "Unknown",
            videoId: video.videoId
        };
    } catch (error) {
        console.error("[yt-search] error:", error.message);
        return null;
    }
}

// ======================================================
// NEW API HELPER
// Response:
// {
//   status: true,
//   creator: "JawadTechXD",
//   result: {
//     title: "...",
//     mp3: "https://...",
//     mp4: "https://..."
//   }
// }
// ======================================================

async function fetchYouTubeMedia(targetUrl) {
    const response = await axios.get(YT_API_BASE, {
        params: {
            url: targetUrl
        },
        timeout: 60000
    });

    const data = response?.data;

    if (data?.status !== true || !data?.result) {
        throw new Error("API failed to return a valid result.");
    }

    return {
        title: data.result.title || "Unknown Title",
        mp3: data.result.mp3 || null,
        mp4: data.result.mp4 || null,
        creator: data.creator || "Unknown"
    };
}

// ======================================================
// COMMON HANDLER — MP3 / MP4
// ======================================================

async function handleYouTubeMedia(
    conn,
    mek,
    m,
    { from, args, reply, userConfig },
    mediaType = "mp3"
) {
    try {
        let query = args.join(" ").trim();

        // Reply-to YouTube link support
        if (!query && m.quoted) {
            const quoted = m.quoted;

            const quotedText =
                quoted.text ||
                quoted.body ||
                quoted.message?.conversation ||
                quoted.message?.extendedTextMessage?.text ||
                quoted.msg?.text ||
                "";

            if (isYouTubeUrl(quotedText)) {
                query = quotedText.trim();
            }
        }

        if (!query) {
            return reply(
                `🎬 *YouTube Downloader Usage:*\n\n` +
                `🎵 *.song <YouTube link>*\n` +
                `🎵 *.song <song name>*\n` +
                `▶️ *.play <song name or link>*\n` +
                `🎥 *.video <YouTube link>*\n\n` +
                `↪️ Reply to a YouTube link with the command.`
            );
        }

        await conn.sendMessage(from, {
            react: { text: "🔍", key: mek.key }
        });

        let targetUrl;
        let metaInfo = null;

        if (isYouTubeUrl(query)) {
            targetUrl = normalizeYouTubeUrl(query);

            if (!extractVideoId(targetUrl)) {
                await conn.sendMessage(from, {
                    react: { text: "❌", key: mek.key }
                });

                return reply("❌ Invalid YouTube URL.");
            }
        } else {
            const found = await searchYouTube(query);

            if (!found) {
                await conn.sendMessage(from, {
                    react: { text: "❌", key: mek.key }
                });

                return reply("❌ No results found on YouTube.");
            }

            targetUrl = normalizeYouTubeUrl(found.url);
            metaInfo = found;
        }

        await conn.sendMessage(from, {
            react: { text: "⏳", key: mek.key }
        });

        // Fetch media from the new API
        const result = await fetchYouTubeMedia(targetUrl);

        const mediaUrl = mediaType === "mp4"
            ? result.mp4
            : result.mp3;

        if (!mediaUrl) {
            await conn.sendMessage(from, {
                react: { text: "❌", key: mek.key }
            });

            return reply(
                mediaType === "mp4"
                    ? "❌ API did not return an MP4 download URL."
                    : "❌ API did not return an MP3 download URL."
            );
        }

        const title = result.title || metaInfo?.title || "YouTube Media";
        const thumbnail = metaInfo?.thumbnail || "";
        const author = metaInfo?.author || "Unknown";
        const duration = metaInfo?.duration || "N/A";
        const botname =
            userConfig?.BOT_NAME ||
            config.BOT_NAME ||
            "SMD-MINI";

        const caption =
            `${mediaType === "mp4" ? "🎬" : "🎵"} *${toSmallCaps(title)}*\n\n` +
            `┌───────────────────⭓\n` +
            `│ 👤 *Artist:* ${author}\n` +
            `│ ⏱️ *Duration:* ${duration}\n` +
            `│ 📁 *Format:* ${mediaType.toUpperCase()}\n` +
            `└───────────────────⭓\n\n` +
            `> ⚡ Powered By ${toSmallCaps(botname)}`;

        await conn.sendMessage(from, {
            react: { text: "⬇️", key: mek.key }
        });

        // Optional thumbnail preview
        if (mediaType === "mp3" && thumbnail) {
            try {
                await conn.sendMessage(
                    from,
                    {
                        image: { url: thumbnail },
                        caption,
                        contextInfo: {
                            mentionedJid: m.sender ? [m.sender] : [],
                            forwardingScore: 999,
                            isForwarded: true,
                            externalAdReply: {
                                title,
                                body: `${duration} • MP3`,
                                mediaType: 1,
                                thumbnailUrl: thumbnail,
                                sourceUrl: targetUrl,
                                renderLargerThumbnail: true,
                                showAdAttribution: true
                            }
                        }
                    },
                    { quoted: mek }
                );
            } catch (error) {
                console.error(
                    "[YouTube thumbnail] error:",
                    error.message
                );
            }
        }

        // Send MP3 audio or MP4 video
        if (mediaType === "mp4") {
            await conn.sendMessage(
                from,
                {
                    video: { url: mediaUrl },
                    mimetype: "video/mp4",
                    fileName: `${title.replace(/[\\/:*?"<>|]/g, "_")}.mp4`,
                    caption,
                    contextInfo: {
                        mentionedJid: m.sender ? [m.sender] : [],
                        forwardingScore: 999,
                        isForwarded: true,
                        externalAdReply: {
                            title,
                            body: `${duration} • MP4`,
                            mediaType: 1,
                            thumbnailUrl: thumbnail || undefined,
                            sourceUrl: targetUrl,
                            renderLargerThumbnail: true,
                            showAdAttribution: true
                        }
                    }
                },
                { quoted: mek }
            );
        } else {
            await conn.sendMessage(
                from,
                {
                    audio: { url: mediaUrl },
                    mimetype: "audio/mpeg",
                    ptt: false,
                    fileName: `${title.replace(/[\\/:*?"<>|]/g, "_")}.mp3`,
                    contextInfo: {
                        mentionedJid: m.sender ? [m.sender] : [],
                        forwardingScore: 999,
                        isForwarded: true,
                        externalAdReply: {
                            title,
                            body: `${duration} • MP3`,
                            mediaType: 1,
                            thumbnailUrl: thumbnail || undefined,
                            sourceUrl: targetUrl,
                            renderLargerThumbnail: true,
                            showAdAttribution: true
                        }
                    }
                },
                { quoted: mek }
            );
        }

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (error) {
        console.error("[YouTube downloader] error:", error);

        await conn.sendMessage(from, {
            react: { text: "❌", key: mek.key }
        }).catch(() => {});

        const message =
            error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Unknown error";

        return reply(`❌ Download Error: ${message}`);
    }
}

// ======================================================
// .song — MP3
// ======================================================

bandah(
    {
        pattern: "song",
        alias: ["ytmp3", "ytaudio", "music"],
        desc: "Download YouTube audio (MP3)",
        category: "download",
        react: "🎵",
        filename: __filename
    },
    async (conn, mek, m, ctx) => {
        return handleYouTubeMedia(
            conn, mek, m, ctx, "mp3"
        );
    }
);

// ======================================================
// .play — MP3
// ======================================================

bandah(
    {
        pattern: "play",
        alias: ["ply", "playsong"],
        desc: "Play / download a song from YouTube",
        category: "download",
        react: "▶️",
        filename: __filename
    },
    async (conn, mek, m, ctx) => {
        return handleYouTubeMedia(
            conn, mek, m, ctx, "mp3"
        );
    }
);

// ======================================================
// .video — MP4
// ======================================================

bandah(
    {
        pattern: "video",
        alias: ["ytmp4", "ytvideo"],
        desc: "Download YouTube video (MP4)",
        category: "download",
        react: "🎬",
        filename: __filename
    },
    async (conn, mek, m, ctx) => {
        return handleYouTubeMedia(
            conn, mek, m, ctx, "mp4"
        );
    }
);
