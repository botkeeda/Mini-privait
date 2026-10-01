import dotenv from "dotenv";
import settings from "./settings.js";

dotenv.config();

const config = {
    MONGODB_URL:
        process.env.DATABASE_URL|| settings.DATABASE ||
        "",

    DB_NAME: process.env.DB_NAME || settings.DB_NAME || "smd-bot",
    PORT: process.env.PORT || settings.PORT || "20252",

    COLLECTIONS: {
        SESSIONS: "whatsapp_sessions",
        NUMBERS: "active_numbers",
        CONFIGS: "bot_configs",
    },

    GROUP_CONFIG: {},

    AUTO_VIEW_STATUS: "true",
    AUTO_STATUS_REACT: "true",
    AUTO_STATUS_REPLY: "false",
    AUTO_STATUS_MSG: "Hello from TEAM-BANDAHEALI !",
    ANTI_STATUS: "true",

    AUTO_RECORDING: "false",
    AUTO_REACT: "false",
    AUTO_TYPING: "false",
    ALWAYS_ONLINE: "false",
    OWNER_REACT: "false",
    HEART_REACT: "false",
    CUSTOM_REACT: "false",

    AUTO_REPLY: "false",
    AUTO_STICKER: "false",
    AUTO_DOWNLOAD: "false",
    MENTION_REPLY: "false",
    AUTO_BIO: process.env.AUTO_BIO || "false",

    VERSION: "3.0.0",
    DESCRIPTION: "*© POWERED BY SMD-MINI*",

    ANTI_DELETE_PATH: "inbox",
    ANTI_DELETE: "false",

    ANTI_EDIT_PATH: "inbox",
    ANTI_EDIT: "false",

    STICKER_NAME: "SMD-MINI",

    ANTI_LINK: "true",
    ANTI_LINK_ACTION: "delete",

    ANTI_CALL: "false",
    REJECT_MSG: "*_Sorry For Cutting The Call Because My Owner Turned On The AntiCall So Calls Will Be AutoMatic Rejected...!_*",

    ANTI_FORIGN: "false",
    ANTI_FORIGN_NUMBER: "91,97,225",

    ANTI_PROMOTE: "false",
    ANTI_BAD: "false",

    WELCOME: "false",
    GOODBYE: "false",
    ADMIN_ACTION: "false",

    MODE: "public",
    CHATBOT: "false",

    PREFIX: ".",

    READ_MESSAGE: "false",

    MENU_IMG: "https://bandaheali-cdn.koyeb.app/bandaheali/team.jpg",

    BOT_NAME: "SMD-MINI",
    CAPTION: "Powered by Team-Bandaheali",

    OWNER_NAME: "TEAM-BANDAHEALI",
    OWNER_NUMBER: "923253617422",
    DEV: "923253617422",

    IK_IMAGE_PATH: "./lib/smd.jpg",
    BOT_IMAGE: "https://bandaheali-cdn.koyeb.app/bandaheali/smd.jpg",

    NEWSLETTER_JID: "120363425554841316@newsletter",
    NEWSLETTER_MESSAGE_ID: "428",

    OWNER_EMOJIS: ["❤️", "🔥", "👑", "⭐", "💎"],
    REACT_EMOJIS: [
        "😂",
        "❤️",
        "🔥",
        "👍",
        "😮",
        "😢",
        "🤣",
        "👍",
        "🎉",
        "🤔",
        "🙏",
        "😯",
        "😊",
        "🥰",
        "💕",
        "🤩",
        "✨",
        "😎",
        "🥳",
        "🙌",
    ],

    STATUS_EMOJIS: ["❤️", "👍", "😮", "😎"],

    CUSTOM_EMOJIS: ["❤️", "🔥", "👍", "😊"],

    MAX_RETRIES: 40,
    OTP_EXPIRY: 300000,

    BANNED: [],

    SUDO: ["923253617422@s.whatsapp.net"],

    DEFAULT_SETTINGS: {
        GROUP_CONFIG: {},
        AUTO_VIEW_STATUS: "true",
        AUTO_STATUS_REACT: "true",
        AUTO_STATUS_REPLY: "false",
        AUTO_STATUS_MSG: "Hello from TEAM-BANDAHEALI !",
        READ_MESSAGE: "false",
        ANTI_STATUS: "true",

        AUTO_RECORDING: "false",
        AUTO_REACT: "false",
        AUTO_TYPING: "false",
        ALWAYS_ONLINE: "false",
        OWNER_REACT: "false",
        HEART_REACT: "false",
        CUSTOM_REACT: "false",

        AUTO_REPLY: "false",
        AUTO_STICKER: "false",
        AUTO_DOWNLOAD: "false",
        MENTION_REPLY: "false",
        AUTO_BIO: "false",

        ANTI_DELETE: "false",
        ANTI_DELETE_PATH: "inbox",

        ANTI_EDIT: "false",
        ANTI_EDIT_PATH: "inbox",

        ANTI_CALL: "false",

        ANTI_LINK: "false",
        ANTI_LINK_ACTION: "delete",

        ANTI_FORIGN: "false",
        ANTI_FORIGN_NUMBER: "91,97,225",

        ANTI_PROMOTE: "false",
        ANTI_DEMOTE: false,
        ANTI_BAD: "false",

        WELCOME: "false",
        GOODBYE: "false",
        ADMIN_EVENT: "false",

        WELCOME_MESSAGE: "*_@user joined the group, welcome! 🎉_*",

        GOODBYE_MESSAGE:
            "*_@user has left the group, we will miss them! 👋_*",

        REJECT_MSG:
            "*_Soory For Cutting The Call Because My Owner Turned On The AntiCall So Calls Will Be AutoMatic Rejected...!_*",

        VERSION: "3.0.0",

        OWNER_NAME: "TEAM-BANDAHEALI",
        OWNER_NUMBER: "923253617422",
        DEV: "923253617422",

        DESCRIPTION: "*© POWERED BY SMD-MINI*",

        STICKER_NAME: "SMD-MINI",

        MODE: "public",
        CHATBOT: "false",

        PREFIX: ".",

        BOT_NAME: "SMD-MINI",

        BOT_IMAGE:
            "https://bandaheali-cdn.koyeb.app/bandaheali/smd-mini.jpg",

        MENU_IMG:
            "https://bandaheali-cdn.koyeb.app/bandaheali/team.jpg",

        CAPTION: "Powered by Team-Bandaheali",

        REACT_EMOJIS: [
            "😂",
            "❤️",
            "🔥",
            "👍",
            "😮",
            "😢",
            "🤣",
            "👍",
            "🎉",
            "🤔",
            "🙏",
            "😯",
            "😊",
            "🥰",
            "💕",
            "🤩",
            "✨",
            "😎",
            "🥳",
            "🙌",
        ],
   
        OWNER_EMOJIS: ["❤️", "🔥", "👑", "⭐", "💎"],

        STATUS_EMOJIS: ["❤️", "👍", "😮", "😎"],

        CUSTOM_EMOJIS: ["❤️", "🔥", "👍", "😊"],

        BANNED: [],

        SUDO: ["923253617422@s.whatsapp.net"],
    },
};

export default config;
export { config };
