// ======================================================
// plugins/tools.js
// FULL FINAL UPDATED VERSION — URL CDNs ONLY
// ======================================================

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

import os from 'os';
import path from 'path';
import fs from 'fs';

import { cmd } from '../command.js';
import config from '../config.js';

import axios from 'axios';
import FormData from 'form-data';
import ImageKit from 'imagekit';

import { Button } from '../lib/buttons.js';

const IMGBB_API_KEY = "a9acd87679ca03c77074cdc41038b426";

// ======================================================
// FORMAT BYTES
// ======================================================

function formatBytes(bytes) {
    if (!bytes) return "0 Bytes";
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// ======================================================
// SAFE CHAT
// ======================================================

function getFrom(mek, m) {
    return (
        mek?.key?.remoteJid ||
        m?.chat ||
        m?.from
    );
}

// ======================================================
// GET MEDIA
// ======================================================

function getAnyMedia(m, conn) {
    const quoted = m.quoted || m;

    const msg =
        quoted.message?.imageMessage ||
        quoted.message?.videoMessage ||
        quoted.message?.audioMessage ||
        quoted.message?.documentMessage ||
        quoted.message?.stickerMessage ||
        quoted.msg ||
        quoted;

    const mime = msg?.mimetype || '';

    const type =
        mime.startsWith("image") ? "image" :
        mime.startsWith("video") ? "video" :
        mime.startsWith("audio") ? "audio" :
        mime.includes("application") ? "document" :
        "file";

    return {
        quoted,
        msg,
        mime,
        type,
        fileName: msg?.fileName || `file_${Date.now()}`,
        download: async () => {
            if (quoted && typeof quoted.download === 'function') {
                return await quoted.download();
            }
            if (m && typeof m.download === 'function') {
                return await m.download();
            }
            if (conn && typeof conn.downloadMediaMessage === 'function') {
                return await conn.downloadMediaMessage(quoted);
            }
            if (conn && typeof conn.downloadAndSaveMediaMessage === 'function') {
                const tempFile = path.join(os.tmpdir(), `temp_dl_${Date.now()}`);
                await conn.downloadAndSaveMediaMessage(quoted, tempFile);
                if (fs.existsSync(tempFile)) {
                    const buf = fs.readFileSync(tempFile);
                    fs.unlinkSync(tempFile);
                    return buf;
                }
            }
            throw new Error("media.download is not a function and no fallback found");
        }
    };
}

// ======================================================
// HELPERS
// ======================================================

function getFileType(mimeType) {
    if (mimeType?.startsWith('image/')) return '🖼️ Image';
    if (mimeType?.startsWith('video/')) return '🎥 Video';
    if (mimeType?.startsWith('audio/')) return '🎵 Audio';
    return '📄 File';
}

function getExtension(mimeType) {
    if (!mimeType) return '.bin';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return '.jpg';
    if (mimeType.includes('png')) return '.png';
    if (mimeType.includes('gif')) return '.gif';
    if (mimeType.includes('webp')) return '.webp';
    if (mimeType.includes('mp4')) return '.mp4';
    if (mimeType.includes('webm')) return '.webm';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return '.mp3';
    if (mimeType.includes('wav')) return '.wav';
    if (mimeType.includes('ogg')) return '.ogg';
    if (mimeType.includes('pdf')) return '.pdf';
    if (mimeType.includes('zip')) return '.zip';
    return '.bin';
}

// ======================================================
// UPLOAD PROVIDERS
// ======================================================

// 1. UGUU
async function uploadToUguu(buffer, mimeType) {
    if (!Buffer.isBuffer(buffer)) throw new TypeError('Invalid input type, expects buffer');

    const ext = getExtension(mimeType);
    const filename = `uguu_${Date.now()}${ext}`;

    try {
        const fd = new globalThis.FormData();
        fd.append('files[]', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), filename);
        const r = await fetch('https://uguu.se/upload.php', {
            method: 'POST',
            body: fd,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const j = await r.json();
        const url = j.files?.[0]?.url;
        if (url && typeof url === 'string' && url.startsWith('http')) return url.trim();
    } catch (_) {}

    try {
        const form = new FormData();
        form.append('files[]', buffer, { filename, contentType: mimeType || 'application/octet-stream' });
        const response = await axios.post('https://uguu.se/upload.php', form, {
            headers: {
                'Origin': 'https://uguu.se',
                'Referer': 'https://uguu.se/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                ...form.getHeaders()
            },
            timeout: 30000,
            maxBodyLength: Infinity
        });
        const url = response.data.files?.[0]?.url;
        if (url) return url.trim();
    } catch (_) {}

    throw new Error('Uguu upload failed');
}

// 2. QUAX
async function uploadQuax(buffer, mimeType) {
    if (!Buffer.isBuffer(buffer)) throw new TypeError('Invalid input type, expects buffer');

    const ext = getExtension(mimeType);
    const filename = `quax_${Date.now()}${ext}`;

    try {
        const fd = new globalThis.FormData();
        fd.append('files[]', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), filename);
        const r = await fetch('https://qu.ax/upload.php', {
            method: 'POST',
            body: fd,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const j = await r.json();
        const url = j.files?.[0]?.url;
        if (url && typeof url === 'string' && url.startsWith('http')) return url.trim();
    } catch (_) {}

    try {
        const form = new FormData();
        form.append('files[]', buffer, { filename, contentType: mimeType || 'application/octet-stream' });
        const response = await axios.post('https://qu.ax/upload.php', form, {
            headers: {
                'Origin': 'https://qu.ax',
                'Referer': 'https://qu.ax/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                ...form.getHeaders()
            },
            timeout: 30000,
            maxBodyLength: Infinity
        });
        const url = response.data.files?.[0]?.url;
        if (url && typeof url === 'string' && url.startsWith('http')) return url.trim();
    } catch (_) {}

    return await uploadLitterbox(buffer, mimeType);
}

// 3. TMPFILES
async function uploadTmpfiles(buffer, mimeType) {
    if (!Buffer.isBuffer(buffer)) throw new TypeError('Invalid input type, expects buffer');

    const ext = getExtension(mimeType);
    const filename = `file_${Date.now()}${ext}`;

    try {
        const fd = new globalThis.FormData();
        fd.append('file', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), filename);
        const r = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: fd });
        const j = await r.json();
        if (j.data?.url) return j.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    } catch (_) {}

    try {
        const form = new FormData();
        form.append('file', buffer, { filename, contentType: mimeType || 'application/octet-stream' });
        const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
            headers: form.getHeaders(),
            timeout: 30000,
            maxBodyLength: Infinity
        });
        if (res.data?.data?.url) return res.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    } catch (_) {}

    throw new Error('Tmpfiles upload failed');
}

// 4. TELEGRAPH (routes to working CDNs)
async function uploadTelegraph(buffer, mimeType) {
    try {
        return await uploadTmpfiles(buffer, mimeType);
    } catch (_) {
        return await uploadQuax(buffer, mimeType);
    }
}

// 5. PUTICU
async function uploadPuticu(buffer, mimeType) {
    if (!Buffer.isBuffer(buffer)) throw new TypeError('Invalid input type, expects buffer');

    try {
        const response = await fetch('https://put.icu/upload/', {
            method: 'PUT',
            headers: {
                'Accept': 'application/json',
                'Content-Type': mimeType || 'application/octet-stream'
            },
            body: buffer
        });
        const j = await response.json();
        const url = j.direct_url || j.url;
        if (url) return url.trim();
    } catch (_) {}

    const response = await axios.put('https://put.icu/upload/', buffer, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': mimeType || 'application/octet-stream'
        },
        timeout: 30000
    });

    const url = response.data.direct_url || response.data.url;
    if (!url) throw new Error('Puticu upload failed');
    return url.trim();
}

// 6. FREEIMAGE
async function uploadFreeimage(buffer, mimeType) {
    if (!Buffer.isBuffer(buffer)) throw new TypeError('Invalid input type, expects buffer');

    try {
        const fd = new globalThis.FormData();
        fd.append('source', buffer.toString('base64'));
        fd.append('type', 'base64');
        fd.append('key', '6d207e02198a847aa98d0a2a901485a5');
        const r = await fetch('https://freeimage.host/api/1/upload', { method: 'POST', body: fd });
        const j = await r.json();
        if (j.image?.url) return j.image.url.trim();
    } catch (_) {}

    return await uploadTmpfiles(buffer, mimeType);
}

// 7. LITTERBOX
async function uploadLitterbox(buffer, mimeType) {
    if (!Buffer.isBuffer(buffer)) throw new TypeError('Invalid input type, expects buffer');

    const ext = getExtension(mimeType);
    const filename = `catbox_${Date.now()}${ext}`;

    const fd = new globalThis.FormData();
    fd.append('reqtype', 'fileupload');
    fd.append('time', '72h');
    fd.append('fileToUpload', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), filename);
    const r = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
        method: 'POST',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        body: fd
    });
    const text = (await r.text()).trim();
    if (text.startsWith('http')) return text;
    throw new Error('Litterbox upload failed: ' + text);
}

// 8. GOFILE
async function uploadGofile(buffer, mimeType) {
    if (!Buffer.isBuffer(buffer)) throw new TypeError('Invalid input type, expects buffer');

    const ext = getExtension(mimeType);
    const filename = `gofile_${Date.now()}${ext}`;

    let server = 'store1';
    try {
        const sRes = await (await fetch('https://api.gofile.io/servers')).json();
        server = sRes.data?.servers?.[0]?.name || 'store1';
    } catch (_) {}

    const fd = new globalThis.FormData();
    fd.append('file', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), filename);
    const r = await fetch(`https://${server}.gofile.io/contents/uploadfile`, { method: 'POST', body: fd });
    const j = await r.json();
    if (j.data?.downloadPage) return j.data.downloadPage;
    throw new Error('Gofile upload failed');
}

// 9. FILEBIN
async function uploadFilebin(buffer, mimeType) {
    if (!Buffer.isBuffer(buffer)) throw new TypeError('Invalid input type, expects buffer');

    const ext = getExtension(mimeType);
    const bin = 'bin_' + Math.random().toString(36).slice(2, 8);
    const filename = `upload_${Date.now()}${ext}`;
    const r = await fetch(`https://filebin.net/${bin}/${filename}`, {
        method: 'POST',
        headers: { 'Content-Type': mimeType || 'application/octet-stream' },
        body: buffer
    });
    const j = await r.json();
    const fname = j.file?.filename || filename;
    return `https://filebin.net/${bin}/${fname}`;
}

// 10. SMART UNIVERSAL (auto best CDN)
async function uploadSmartUniversal(buffer, mimeType) {
    const isImg = mimeType && mimeType.startsWith('image/');
    const errors = [];

    if (isImg) {
        try {
            const form = new FormData();
            form.append("image", buffer.toString("base64"));
            const res = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, form, {
                headers: form.getHeaders(),
                timeout: 15000
            });
            if (res.data?.success && res.data?.data?.url) {
                return { url: res.data.data.url, provider: "ImgBB CDN" };
            }
        } catch (e) { errors.push(`ImgBB: ${e.message}`); }

        try {
            const url = await uploadFreeimage(buffer, mimeType);
            if (url) return { url, provider: "FreeImage (iili.io)" };
        } catch (e) { errors.push(`FreeImage: ${e.message}`); }
    }

    try {
        const url = await uploadTmpfiles(buffer, mimeType);
        if (url) return { url, provider: "TmpFiles Direct DL" };
    } catch (e) { errors.push(`Tmpfiles: ${e.message}`); }

    try {
        const url = await uploadQuax(buffer, mimeType);
        if (url) return { url, provider: "Qu.ax CDN" };
    } catch (e) { errors.push(`Quax: ${e.message}`); }

    try {
        const url = await uploadLitterbox(buffer, mimeType);
        if (url) return { url, provider: "Catbox Litterbox" };
    } catch (e) { errors.push(`Litterbox: ${e.message}`); }

    try {
        const url = await uploadToUguu(buffer, mimeType);
        if (url) return { url, provider: "Uguu CDN" };
    } catch (e) { errors.push(`Uguu: ${e.message}`); }

    try {
        const url = await uploadPuticu(buffer, mimeType);
        if (url) return { url, provider: "Put.icu CDN" };
    } catch (e) { errors.push(`Puticu: ${e.message}`); }

    throw new Error(`All upload providers failed: ${errors.join(' | ')}`);
}

// ======================================================
// IMAGEKIT INSTANCE
// ======================================================

const imagekit = new ImageKit({
    publicKey: "public_w4ShA/mSPCS0gEIcfkLkRFPIFuk=",
    privateKey: "private_0P++iFHysVyiHM5dG7GBR0np124=",
    urlEndpoint: "https://ik.imagekit.io/shaban"
});

// ======================================================
// UNIVERSAL RESPONSE SENDER
// Text PEHLE bhejo, phir button try karo
// ======================================================

async function sendUrlResponse(conn, mek, from, title, type, size, url) {
    const text =
        `╭━━━❰ *✅ ${title}* ❱━━━╮\n` +
        `┃ 📁 Type: ${type}\n` +
        `┃ 📏 Size: ${size}\n` +
        `┃ 🌐 URL:\n┃ ${url}\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━╯`;

    // 1) Text GUARANTEED
    try {
        await conn.sendMessage(from, { text }, { quoted: mek });
    } catch (e) {
        console.log('[sendUrlResponse] text failed:', e?.message || e);
    }

    // 2) Button (optional)
    try {
        const btn = new Button(conn);
        btn.setBody(text);
        btn.addCopy("📋 Copy URL", url);
        btn.addUrl("🖼️ View Media", url);
        await btn.send(from, { quoted: mek });
    } catch (e) {
        console.log('[sendUrlResponse] button failed:', e?.message || e);
    }
}

async function sendMultiUrlResponse(conn, mek, from, type, size, links) {
    let text =
        `╭━━━❰ *🚀 MULTI-HOST CDN* ❱━━━╮\n` +
        `┃ 📁 Type: ${type}\n` +
        `┃ 📏 Size: ${size}\n` +
        `┣━━━━━━━━━━━━━━━━━━━━━━┫\n`;
    for (const item of links) {
        text += `┃ 🌐 *${item.name}:*\n┃ ${item.url}\n┣━━━━━━━━━━━━━━━━━━━━━━┫\n`;
    }
    text += `╰━━━━━━━━━━━━━━━━━━━━━━╯`;

    try {
        await conn.sendMessage(from, { text }, { quoted: mek });
    } catch (e) {
        console.log('[sendMultiUrlResponse] text failed:', e?.message || e);
    }

    try {
        const btn = new Button(conn);
        btn.setBody(text);
        if (links[0]) btn.addCopy("📋 Copy Link 1", links[0].url);
        if (links[1]) btn.addCopy("📋 Copy Link 2", links[1].url);
        if (links[0]) btn.addUrl("🖼️ View Media", links[0].url);
        await btn.send(from, { quoted: mek });
    } catch (e) {
        console.log('[sendMultiUrlResponse] button failed:', e?.message || e);
    }
}

// ======================================================
// UNIVERSAL URL COMMAND HANDLER
// Har url cmd ek hi core function use karega
// ======================================================

async function runUrlUpload(conn, mek, m, { reply }, uploaderFn, label) {
    const from = getFrom(mek, m);

    try {
        const media = getAnyMedia(m, conn);
        if (!media.mime) {
            return reply("📎 Reply To Any Media (Image, Video, Audio, Document)");
        }

        try {
            await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });
        } catch (_) {}

        const buffer = await media.download();
        if (!buffer) throw new Error("Failed to download media");

        const result = await uploaderFn(buffer, media.mime);

        // result can be string or { url, provider }
        const url = typeof result === 'string' ? result : result.url;
        const provider = typeof result === 'string' ? label : (result.provider || label);

        try {
            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        } catch (_) {}

        await sendUrlResponse(
            conn,
            mek,
            from,
            provider.toUpperCase(),
            media.type,
            formatBytes(buffer.length),
            url
        );

    } catch (err) {
        console.log('[URL CMD ERROR]', err);
        try { reply(`❌ Error: ${err.message}`); } catch (_) {}
    }
}

// ======================================================
// URL 1 — SMART UNIVERSAL
// ======================================================

cmd({
    pattern: "url",
    alias: ["cdn", "upload", "tourl"],
    desc: "Upload any media to fastest working CDN",
    react: "🚀",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    await runUrlUpload(conn, mek, m, { reply }, uploadSmartUniversal, "Smart CDN");
});

// ======================================================
// URL 2 — IMAGEKIT
// ======================================================

cmd({
    pattern: "url2",
    alias: ["imgkit", "ikup"],
    desc: "Upload media to ImageKit",
    react: "📤",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    await runUrlUpload(conn, mek, m, { reply }, async (buffer, mime) => {
        let extension = getExtension(mime).replace('.', '') || "bin";
        try {
            const uploadResponse = await imagekit.upload({
                file: buffer.toString("base64"),
                fileName: `SHABAN-${Date.now()}.${extension}`
            });
            return { url: uploadResponse.url, provider: "ImageKit" };
        } catch (_) {
            const url = await uploadFreeimage(buffer, mime);
            return { url, provider: "FreeImage (Fallback)" };
        }
    }, "ImageKit");
});

// ======================================================
// URL 3 — UGUU
// ======================================================

cmd({
    pattern: "url3",
    alias: ["uguu", "uguuurl"],
    desc: "Upload media to Uguu.se",
    react: "🌐",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    await runUrlUpload(conn, mek, m, { reply }, uploadToUguu, "Uguu");
});

// ======================================================
// URL 4 — QUAX
// ======================================================

cmd({
    pattern: "url4",
    alias: ["quax", "quaxurl"],
    desc: "Upload media to Qu.ax CDN",
    react: "🌐",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    await runUrlUpload(conn, mek, m, { reply }, uploadQuax, "Qu.ax");
});

// ======================================================
// URL 5 — TELEGRAPH / TMPFILES
// ======================================================

cmd({
    pattern: "url5",
    alias: ["telegraph", "tgurl", "tmpfiles", "tmpurl"],
    desc: "Upload media to Direct CDN (Telegraph / TmpFiles)",
    react: "🌐",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    await runUrlUpload(conn, mek, m, { reply }, uploadTelegraph, "Direct CDN");
});

// ======================================================
// URL 6 — PUTICU
// ======================================================

cmd({
    pattern: "url6",
    alias: ["puticu", "puturl"],
    desc: "Upload media to Put.icu",
    react: "🌐",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    await runUrlUpload(conn, mek, m, { reply }, uploadPuticu, "Put.icu");
});

// ======================================================
// URL 7 — FREEIMAGE / IILI.IO
// ======================================================

cmd({
    pattern: "url7",
    alias: ["freeimage", "iili", "iimg", "iimgurl"],
    desc: "Upload media to FreeImage (iili.io)",
    react: "🌐",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    await runUrlUpload(conn, mek, m, { reply }, uploadFreeimage, "FreeImage");
});

// ======================================================
// URL 8 — CATBOX LITTERBOX
// ======================================================

cmd({
    pattern: "url8",
    alias: ["catbox", "catboxurl", "litterbox"],
    desc: "Upload media to Catbox (Litterbox API)",
    react: "🌐",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    await runUrlUpload(conn, mek, m, { reply }, uploadLitterbox, "Catbox");
});

// ======================================================
// URL 9 — GOFILE
// ======================================================

cmd({
    pattern: "url9",
    alias: ["gofile", "gofileurl", "ayanami"],
    desc: "Upload media to Gofile.io",
    react: "🌐",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    await runUrlUpload(conn, mek, m, { reply }, uploadGofile, "Gofile");
});

// ======================================================
// URL 10 — FILEBIN
// ======================================================

cmd({
    pattern: "url10",
    alias: ["filebin", "filebinurl", "envs"],
    desc: "Upload media to Filebin.net",
    react: "🌐",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    await runUrlUpload(conn, mek, m, { reply }, uploadFilebin, "Filebin");
});

// ======================================================
// URL 11 — LITTERBOX DIRECT
// ======================================================

cmd({
    pattern: "url11",
    alias: ["litter", "catboxdl"],
    desc: "Upload to Litterbox Catbox (up to 1GB)",
    react: "📦",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    await runUrlUpload(conn, mek, m, { reply }, uploadLitterbox, "Litterbox");
});

// ======================================================
// URL 12 — GOFILE DIRECT
// ======================================================

cmd({
    pattern: "url12",
    alias: ["gofilelink", "gofilestore"],
    desc: "Upload directly to Gofile.io",
    react: "⚡",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    await runUrlUpload(conn, mek, m, { reply }, uploadGofile, "Gofile Cloud");
});

// ======================================================
// URL 13 — FREEIMAGE DIRECT
// ======================================================

cmd({
    pattern: "url13",
    alias: ["iilihst", "freeimghost"],
    desc: "Upload directly to FreeImage.host",
    react: "🖼️",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    await runUrlUpload(conn, mek, m, { reply }, uploadFreeimage, "FreeImage Host");
});

// ======================================================
// URL 14 — TMPFILES DIRECT DL
// ======================================================

cmd({
    pattern: "url14",
    alias: ["tmpdl", "tmpfile"],
    desc: "Upload to Tmpfiles with direct download link",
    react: "🔗",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    await runUrlUpload(conn, mek, m, { reply }, uploadTmpfiles, "TmpFiles Direct");
});

// ======================================================
// URL 15 — MULTI CDN (3-in-1 parallel)
// ======================================================

cmd({
    pattern: "url15",
    alias: ["allurl", "multiurl", "multiupload"],
    desc: "Upload to multiple high-speed CDNs simultaneously",
    react: "⚡",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    const from = getFrom(mek, m);

    try {
        const media = getAnyMedia(m, conn);
        if (!media.mime) return reply("📎 Reply To Any Media");

        try {
            await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });
        } catch (_) {}

        const buffer = await media.download();
        if (!buffer) throw new Error("Failed to download media");

        const results = await Promise.allSettled([
            uploadTmpfiles(buffer, media.mime).then(url => ({ name: "TmpFiles (Direct)", url })),
            uploadQuax(buffer, media.mime).then(url => ({ name: "Qu.ax CDN", url })),
            uploadToUguu(buffer, media.mime).then(url => ({ name: "Uguu.se", url })),
            uploadLitterbox(buffer, media.mime).then(url => ({ name: "Catbox Litterbox", url }))
        ]);

        const successful = results
            .filter(r => r.status === "fulfilled" && r.value?.url)
            .map(r => r.value);

        if (successful.length === 0) throw new Error("All parallel uploads failed");

        try {
            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        } catch (_) {}

        await sendMultiUrlResponse(
            conn,
            mek,
            from,
            media.type,
            formatBytes(buffer.length),
            successful
        );

    } catch (err) {
        console.log('[URL15 ERROR]', err);
        try { reply(`❌ Error: ${err.message}`); } catch (_) {}
    }
});

// ======================================================
// URL MENU
// ======================================================

cmd({
    pattern: "urlmenu",
    alias: ["urlhelp", "urllist", "cdnhelp"],
    desc: "Display list of all media to URL upload commands",
    react: "📋",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { reply }) => {
    const from = getFrom(mek, m);

    const helpText =
        `╭━━━❰ *🌐 URL UPLOAD COMMANDS* ❱━━━╮\n` +
        `┃\n` +
        `┃ 🚀 *.url*    - Auto Best CDN\n` +
        `┃ 📤 *.url2*   - ImageKit CDN\n` +
        `┃ 🌐 *.url3*   - Uguu.se\n` +
        `┃ ⚡ *.url4*   - Qu.ax CDN\n` +
        `┃ 🔗 *.url5*   - Direct CDN / TmpFiles\n` +
        `┃ 🌐 *.url6*   - Put.icu CDN\n` +
        `┃ 🖼️ *.url7*   - FreeImage / iili.io\n` +
        `┃ 📦 *.url8*   - Catbox Litterbox (1GB)\n` +
        `┃ ☁️ *.url9*   - Gofile.io\n` +
        `┃ 📁 *.url10*  - Filebin.net\n` +
        `┃ 📦 *.url11*  - Litterbox Direct\n` +
        `┃ ⚡ *.url12*  - Gofile Cloud Direct\n` +
        `┃ 🖼️ *.url13*  - FreeImage.host\n` +
        `┃ 📥 *.url14*  - Tmpfiles Direct DL\n` +
        `┃ 🌟 *.url15*  - Multi-CDN (Parallel)\n` +
        `┃\n` +
        `┣━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n` +
        `┃ 💡 Reply to any media with these cmds.\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

    try {
        await conn.sendMessage(from, { text: helpText }, { quoted: mek });
    } catch (e) {
        console.log('[urlmenu] text failed:', e?.message || e);
    }

    try {
        const btn = new Button(conn);
        btn.setBody(helpText);
        btn.addCopy("📋 Copy .url", ".url");
        btn.addCopy("📋 Copy .url15", ".url15");
        await btn.send(from, { quoted: mek });
    } catch (e) {
        console.log('[urlmenu] button failed:', e?.message || e);
    }
});