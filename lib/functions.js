// lib/functions.js

const getBuffer = async (url, options) => {
    try {
        options = options || {};
        const res = await fetch(url, {
            headers: {
                'DNT': '1',
                'Upgrade-Insecure-Requests': '1',
                ...(options.headers || {})
            }
        });
        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (e) {
        console.error('[ ❌ ] getBuffer error:', e);
        return null;
    }
};

const getGroupAdmins = (participants = []) => {
	const admins = new Set();
	for (let i of participants) {
		if (i && (i.admin !== null && i.admin !== undefined && i.admin !== false)) {
            const ids = [i.id, i.jid, i.phoneNumber].filter(Boolean);
            for (const rawId of ids) {
                if (typeof rawId !== 'string') continue;
                // Remove device suffix e.g. :1@s.whatsapp.net -> @s.whatsapp.net
                const clean = rawId.split(':')[0].trim();
                if (clean) admins.add(clean);

                const num = clean.split('@')[0];
                if (num && /^\d+$/.test(num)) {
                    admins.add(num);
                    if (!clean.endsWith('@lid')) {
                        admins.add(`${num}@s.whatsapp.net`);
                    }
                }
            }
        }
	}
	return Array.from(admins);
};

const getRandom = (ext) => {
    return `${Math.floor(Math.random() * 10000)}${ext}`;
};

const h2k = (eco) => {
    const lyrik = ['', 'K', 'M', 'B', 'T', 'P', 'E'];
    const ma = Math.log10(Math.abs(eco)) / 3 | 0;
    if (ma === 0) return eco;
    const ppo = lyrik[ma];
    const scale = Math.pow(10, ma * 3);
    const scaled = eco / scale;
    let formatt = scaled.toFixed(1);
    if (/\.0$/.test(formatt)) {
        formatt = formatt.substr(0, formatt.length - 2);
    }
    return formatt + ppo;
};

const isUrl = (url) => {
    return url.match(
        new RegExp(
            /https?:\/\/(www\.)?[-a-zA-Z0-9@:%.+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%+.~#?&/=]*)/,
            'gi'
        )
    );
};

const Json = (string) => {
    return JSON.stringify(string, null, 2);
};

const runtime = (seconds) => {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const dDisplay = d > 0 ? d + (d === 1 ? ' day, ' : ' days, ') : '';
    const hDisplay = h > 0 ? h + (h === 1 ? ' hour, ' : ' hours, ') : '';
    const mDisplay = m > 0 ? m + (m === 1 ? ' minute, ' : ' minutes, ') : '';
    const sDisplay = s > 0 ? s + (s === 1 ? ' second' : ' seconds') : '';
    return dDisplay + hDisplay + mDisplay + sDisplay;
};

const sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const fetchJson = async (url, options) => {
    try {
        options = options || {};
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
                ...(options.headers || {})
            }
        });
        return await res.json();
    } catch (err) {
        console.error('[ ❌ ] fetchJson error:', err);
        return null;
    }
};

// ===== LID TO PHONE FUNCTIONS =====

/**
 * Convert Lid (Local ID) to Phone Number
 * @param {Object} conn - The WhatsApp connection object
 * @param {string} lid - The LID to convert
 * @returns {Promise<string>} - The phone number or original LID part
 */
async function lidToPhone(conn, lid) {
    try {
        if (!lid) return '';
        
        // Check if it's actually a LID (contains @lid)
        if (lid.includes('@lid')) {
            const pn = await conn.signalRepository.lidMapping.getPNForLID(lid);
            if (pn) {
                return cleanPN(pn);
            }
        }
        return lid.split("@")[0];
    } catch (e) {
        // If error, return the part before @
        return lid ? lid.split("@")[0] : '';
    }
}

/**
 * Clean phone number by removing : suffix
 * @param {string} pn - The phone number to clean
 * @returns {string} - Cleaned phone number
 */
function cleanPN(pn) {
    if (!pn) return '';
    return pn.split(":")[0];
}

const delay = sleep;

export { 
    getBuffer, 
    getGroupAdmins, 
    getRandom, 
    h2k, 
    isUrl, 
    Json, 
    runtime, 
    sleep, 
    delay,
    fetchJson,
    lidToPhone,
    cleanPN
};

export default { 
    getBuffer, 
    getGroupAdmins, 
    getRandom, 
    h2k, 
    isUrl, 
    Json, 
    runtime, 
    sleep, 
    delay,
    fetchJson,
    lidToPhone,
    cleanPN
};
