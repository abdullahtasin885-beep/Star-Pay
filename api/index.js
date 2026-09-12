/*
|--------------------------------------------------------------------------
| AURA STAR PAY BOT (MULTI-COLORED VIBRANT UI ⚡) - HIGH PERFORMANCE
| - Bot Username: @AuraStarPay1Bot
| - Super Admin: 8045367594
| - Maintenance Mode (Bot ON/OFF Switch with Instant Notice & Buttons)
| - Mobile-like Blacklist & Whitelist-Only Security Protection
| - Channel-specific Broadcast with Parallel Admin Check (✅/⚠️)
| - First Withdraw Referral Rule (3 Completed Referrals Requirement)
| - Sub-second In-Memory Caching (0.5s - 1.0s Speed Goal)
| - English Clean User Panel & Centralized Admin Management
|--------------------------------------------------------------------------
*/

const express = require('express');

const BOT_TOKEN = '8898720154:AAF_7ZxN3iAUiIFLMMeqYq1L96RmekO2mW4';
const BOT_USERNAME = 'AuraStarPay1Bot';
const APP_URL = 'https://star-pay-go71.onrender.com';
const SUPER_ADMIN_ID = '8045367594';

// Default Central Settings
const DEFAULT_SUPPORT_URL = 'https://t.me/AuraSupportsBot';
const DEFAULT_PAYMENT_CHANNEL_ID = '-1003945593094';
const DEFAULT_PAYMENT_CHANNEL_URL = 'https://t.me/AuraPaymentChannel';
const DEVELOPER_NAME = 'SΛKIB 〆 DΞVΞLOPΞR';
const DEVELOPER_LINK = 'https://t.me/Sakib_Developer1';

/*
|--------------------------------------------------------------------------
| FIREBASE CONFIGURATION
|--------------------------------------------------------------------------
*/
// Supports both direct RTDB and firebaseapp base formats
let FIREBASE_URL = 'https://aura-star-pay-1-default-rtdb.firebaseio.com';
const FIREBASE_FALLBACK_URL = 'https://aura-star-pay-1.firebaseio.com';
const FIREBASE_API_KEY = 'AIzaSyDq337oNcs6G7m3ahBnOhnHzgBhzr892GU';
const FIREBASE_AUTH_EMAIL = 'tasin301210@gmail.com';
const FIREBASE_AUTH_PASSWORD = '#mayabiri';

/*
|--------------------------------------------------------------------------
| ULTRA-FAST IN-MEMORY CACHE STORES (SUB-SECOND GOAL)
|--------------------------------------------------------------------------
*/
const cache = {
    users: new Map(),           // userId -> { data, expiresAt }
    settings: new Map(),        // key -> { value, expiresAt }
    userChannels: new Map(),    // userId -> { isMember, expiresAt }
    forceChannels: null,
    forceChannelsExpiresAt: 0,
    admins: null,
    adminsExpiresAt: 0,
    blacklist: null,
    blacklistExpiresAt: 0,
    whitelist: null,
    whitelistExpiresAt: 0,
    botActive: null,
    botActiveExpiresAt: 0,
    whitelistOnly: null,
    whitelistOnlyExpiresAt: 0
};

function invalidateUserCache(userId) {
    cache.users.delete(String(userId));
    cache.userChannels.delete(String(userId));
}

function invalidateSettingsCache(key = null) {
    if (key) cache.settings.delete(key);
    else cache.settings.clear();
}

function invalidateSecurityCache() {
    cache.blacklist = null;
    cache.blacklistExpiresAt = 0;
    cache.whitelist = null;
    cache.whitelistExpiresAt = 0;
    cache.whitelistOnly = null;
    cache.whitelistOnlyExpiresAt = 0;
}

function invalidateForceChannelsCache() {
    cache.forceChannels = null;
    cache.forceChannelsExpiresAt = 0;
}

/*
|--------------------------------------------------------------------------
| BASIC HELPERS
|--------------------------------------------------------------------------
*/
function escapeHtml(text) {
    if (typeof text !== 'string') text = String(text ?? '');
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatNumber(number) {
    const num = Number(number);
    if (!isFinite(num) || isNaN(num)) return '0';
    if (Math.abs(num - Math.round(num)) < 0.005) {
        return Math.round(num).toString();
    }
    return (Math.round(num * 100) / 100).toString();
}

function normalizeText(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function isNumericAmount(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return false;
    const str = String(value).trim();
    return str !== '' && !isNaN(Number(str)) && isFinite(Number(str));
}

function normalizeWithdrawTarget(input) {
    input = normalizeText(input).trim();
    if (!input) return '';

    const atSlashMatch = input.match(/^@([A-Za-z0-9_]{4,32})\/(\d+)$/);
    if (atSlashMatch) {
        return `https://t.me/${atSlashMatch[1]}/${atSlashMatch[2]}`;
    }

    const postLinkMatch = input.match(/^(?:https?:\/\/)?(?:www\.)?t\.me\/(?:[A-Za-z0-9_]{4,32}|c\/\d+)\/(\d+)\/?$/i);
    if (postLinkMatch) {
        if (!input.startsWith('http://') && !input.startsWith('https://')) {
            input = 'https://' + input.replace(/^\/+/, '');
        }
        return input;
    }

    const channelLinkMatch = input.match(/^(?:https?:\/\/)?(?:www\.)?t\.me\/([A-Za-z0-9_]{4,32})\/?$/i);
    if (channelLinkMatch) {
        return '@' + channelLinkMatch[1];
    }

    if (input.startsWith('@')) return input;
    if (/^[A-Za-z0-9_]{4,32}$/.test(input)) return '@' + input;

    return input;
}

function isValidWithdrawTarget(target) {
    if (!target) return false;
    if (/^@[A-Za-z0-9_]{4,32}$/.test(target)) return true;
    if (/^https?:\/\/t\.me\/(?:[A-Za-z0-9_]{4,32}|c\/\d+)\/\d+\/?$/i.test(target)) return true;
    return false;
}

/*
|--------------------------------------------------------------------------
| FIREBASE REST CLIENT
|--------------------------------------------------------------------------
*/
let cachedToken = null;
let tokenExpiresAt = 0;

async function getFirebaseToken() {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && now < tokenExpiresAt) return cachedToken;

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                email: FIREBASE_AUTH_EMAIL,
                password: FIREBASE_AUTH_PASSWORD,
                returnSecureToken: true,
            })
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !data.idToken) return null;

        cachedToken = data.idToken;
        tokenExpiresAt = now + Math.max(60, (parseInt(data.expiresIn) || 3600) - 60);
        return cachedToken;
    } catch {
        return null;
    }
}

async function firebaseRequest(path, method = 'GET', data = null) {
    path = path.replace(/^\/+|\/+$/g, '');
    if (!path) return null;

    const token = await getFirebaseToken();
    let url = `${FIREBASE_URL.replace(/\/+$/, '')}/${path}.json`;
    if (token) {
        url += `?auth=${encodeURIComponent(token)}`;
    }

    const options = {
        method: method.toUpperCase(),
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    };
    if (data !== null) options.body = JSON.stringify(data);

    try {
        let res = await fetch(url, options);
        if (!res.ok && (res.status === 404 || res.status === 401 || res.status === 403)) {
            // Try fallback URL if default failed
            const fallback = `${FIREBASE_FALLBACK_URL.replace(/\/+$/, '')}/${path}.json${token ? `?auth=${encodeURIComponent(token)}` : ''}`;
            res = await fetch(fallback, options);
        }
        if (!res.ok) return null;
        const text = await res.text();
        if (text === 'null' || text === '') return null;
        return JSON.parse(text);
    } catch {
        return null;
    }
}

/*
|--------------------------------------------------------------------------
| TELEGRAM API CLIENT
|--------------------------------------------------------------------------
*/
async function telegramApi(method, params = {}) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(params)
        });
        const json = await res.json().catch(() => null);
        if (!json) return { ok: false, description: `HTTP ${res.status} error` };
        return json;
    } catch (e) {
        return { ok: false, description: e.message || 'Network request failed' };
    }
}

async function sendMessage(chatId, text, replyMarkup = null) {
    const params = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
    };
    if (replyMarkup) params.reply_markup = replyMarkup;
    return await telegramApi('sendMessage', params);
}

async function editMessageText(chatId, messageId, text, replyMarkup = null) {
    const params = {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
    };
    if (replyMarkup) params.reply_markup = replyMarkup;
    return await telegramApi('editMessageText', params);
}

async function copyMessage(chatId, fromChatId, messageId, replyMarkup = null) {
    const params = {
        chat_id: chatId,
        from_chat_id: fromChatId,
        message_id: messageId
    };
    if (replyMarkup) params.reply_markup = replyMarkup;
    return await telegramApi('copyMessage', params);
}

async function deleteMessage(chatId, messageId) {
    return await telegramApi('deleteMessage', { chat_id: chatId, message_id: messageId });
}

async function answerCallback(callbackId, text = '', showAlert = false) {
    return await telegramApi('answerCallbackQuery', {
        callback_query_id: callbackId,
        text: text,
        show_alert: showAlert
    });
}

async function sendLongMessage(chatId, text, extra = null) {
    const max = 3800;
    if (text.length <= max) return await sendMessage(chatId, text, extra);
    let offset = 0;
    while (offset < text.length) {
        let chunk = text.slice(offset, offset + max);
        offset += chunk.length;
        await sendMessage(chatId, chunk, offset >= text.length ? extra : null);
    }
}

/*
|--------------------------------------------------------------------------
| DATABASE & CACHE ACCESSORS
|--------------------------------------------------------------------------
*/
async function getUser(userId) {
    const uidStr = String(userId);
    const now = Date.now();
    const cached = cache.users.get(uidStr);
    if (cached && now < cached.expiresAt) {
        return cached.data;
    }
    const res = await firebaseRequest(`users/${uidStr}`);
    const user = res && typeof res === 'object' ? res : null;
    if (user) {
        cache.users.set(uidStr, { data: user, expiresAt: now + 60000 });
    }
    return user;
}

async function setUser(userId, data) {
    const uidStr = String(userId);
    cache.users.set(uidStr, { data, expiresAt: Date.now() + 60000 });
    return (await firebaseRequest(`users/${uidStr}`, 'PUT', data)) !== null;
}

async function updateUser(userId, data) {
    const uidStr = String(userId);
    const current = await getUser(uidStr);
    if (current) {
        cache.users.set(uidStr, { data: { ...current, ...data }, expiresAt: Date.now() + 60000 });
    }
    return (await firebaseRequest(`users/${uidStr}`, 'PATCH', data)) !== null;
}

async function getSetting(key, defaultValue = '') {
    const now = Date.now();
    const cached = cache.settings.get(key);
    if (cached && now < cached.expiresAt) {
        return cached.value;
    }
    const val = await firebaseRequest(`settings/${key}`);
    const finalVal = val === null ? defaultValue : val;
    cache.settings.set(key, { value: finalVal, expiresAt: now + 120000 });
    return finalVal;
}

async function setSetting(key, value) {
    cache.settings.set(key, { value, expiresAt: Date.now() + 120000 });
    return (await firebaseRequest(`settings/${key}`, 'PUT', value)) !== null;
}

async function getAllUsers() {
    const res = await firebaseRequest('users');
    return res && typeof res === 'object' ? res : {};
}

async function getAllAdmins() {
    const now = Date.now();
    if (cache.admins && now < cache.adminsExpiresAt) return cache.admins;
    const res = await firebaseRequest('admins');
    cache.admins = res && typeof res === 'object' ? res : {};
    cache.adminsExpiresAt = now + 60000;
    return cache.admins;
}

async function getAllForceChannels(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cache.forceChannels && now < cache.forceChannelsExpiresAt) {
        return cache.forceChannels;
    }
    const res = await firebaseRequest('force_channels');
    cache.forceChannels = res && typeof res === 'object' ? res : {};
    cache.forceChannelsExpiresAt = now + 60000;
    return cache.forceChannels;
}

async function getUserWithdrawals(userId) {
    const all = await firebaseRequest('withdrawals');
    if (!all || typeof all !== 'object') return [];
    const result = [];
    for (const [id, withdraw] of Object.entries(all)) {
        if (withdraw && String(withdraw.user_id) === String(userId)) {
            withdraw._id = String(id);
            result.push(withdraw);
        }
    }
    result.sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
    return result.slice(0, 10);
}

/*
|--------------------------------------------------------------------------
| BOT STATUS (ON / OFF) & SECURITY ACCESS RULES
|--------------------------------------------------------------------------
*/
async function isBotActive() {
    const now = Date.now();
    if (cache.botActive !== null && now < cache.botActiveExpiresAt) {
        return cache.botActive;
    }
    const status = await getSetting('bot_power_status', 'on');
    const isActive = status !== 'off';
    cache.botActive = isActive;
    cache.botActiveExpiresAt = now + 30000;
    return isActive;
}

async function isWhitelistOnlyMode() {
    const now = Date.now();
    if (cache.whitelistOnly !== null && now < cache.whitelistOnlyExpiresAt) {
        return cache.whitelistOnly;
    }
    const status = await getSetting('whitelist_only_mode', 'off');
    const isWl = status === 'on';
    cache.whitelistOnly = isWl;
    cache.whitelistOnlyExpiresAt = now + 30000;
    return isWl;
}

async function getBlacklist() {
    const now = Date.now();
    if (cache.blacklist && now < cache.blacklistExpiresAt) return cache.blacklist;
    const res = await firebaseRequest('security/blacklist');
    cache.blacklist = res && typeof res === 'object' ? res : {};
    cache.blacklistExpiresAt = now + 60000;
    return cache.blacklist;
}

async function getWhitelist() {
    const now = Date.now();
    if (cache.whitelist && now < cache.whitelistExpiresAt) return cache.whitelist;
    const res = await firebaseRequest('security/whitelist');
    cache.whitelist = res && typeof res === 'object' ? res : {};
    cache.whitelistExpiresAt = now + 60000;
    return cache.whitelist;
}

function isSuperAdmin(userId) {
    return String(userId).trim() === SUPER_ADMIN_ID;
}

async function isAdmin(userId) {
    const uidStr = String(userId).trim();
    if (isSuperAdmin(uidStr)) return true;
    const admins = await getAllAdmins();
    return Boolean(admins[uidStr] && admins[uidStr].active === true);
}

// Check security access for a user
async function checkUserAccess(userId) {
    const uidStr = String(userId).trim();
    if (await isAdmin(uidStr)) return { allowed: true };

    // 1. Blacklist check
    const bl = await getBlacklist();
    if (bl[uidStr]) {
        return { allowed: false, reason: 'blacklisted' };
    }

    // 2. Whitelist-only mode check
    const wlOnly = await isWhitelistOnlyMode();
    if (wlOnly) {
        const wl = await getWhitelist();
        if (!wl[uidStr]) {
            return { allowed: false, reason: 'whitelist_only' };
        }
    }

    // 3. Bot Power ON/OFF Check
    const active = await isBotActive();
    if (!active) {
        return { allowed: false, reason: 'bot_off' };
    }

    return { allowed: true };
}

/*
|--------------------------------------------------------------------------
| MAINTENANCE MODE OFF NOTICE WITH BUTTONS
|--------------------------------------------------------------------------
*/
async function sendBotOffMessage(chatId) {
    const supportUrl = await getSetting('support_url', DEFAULT_SUPPORT_URL);
    const sourceLink = await getSetting('source_link', DEVELOPER_LINK);
    const sourceName = await getSetting('source_name', DEVELOPER_NAME);

    const text = 
        `⛔ <b>Bot currently off!</b>\n\n` +
        `🔧 <b>Source:</b> ${escapeHtml(sourceName)}\n` +
        `Support: @${escapeHtml(supportUrl.split('/').pop().replace('@', ''))}`;

    const keyboard = {
        inline_keyboard: [
            [{ text: `🔧 Source: ${sourceName}`, url: sourceLink, style: 'primary' }],
            [{ text: '🎧 Support', url: supportUrl, style: 'success' }]
        ]
    };

    return await sendMessage(chatId, text, keyboard);
}

/*
|--------------------------------------------------------------------------
| ADMIN & USER STATE
|--------------------------------------------------------------------------
*/
async function setAdminState(userId, action, extra = {}) {
    return (await firebaseRequest(`admin_states/${userId}`, 'PUT', {
        action,
        created_at: Math.floor(Date.now() / 1000),
        ...extra
    })) !== null;
}

async function getAdminState(userId) {
    const res = await firebaseRequest(`admin_states/${userId}`);
    return res && typeof res === 'object' ? res : null;
}

async function clearAdminState(userId) {
    await firebaseRequest(`admin_states/${userId}`, 'DELETE');
}

async function setUserState(userId, action, extra = {}) {
    return (await firebaseRequest(`user_states/${userId}`, 'PUT', {
        action,
        created_at: Math.floor(Date.now() / 1000),
        ...extra
    })) !== null;
}

async function getUserState(userId) {
    const res = await firebaseRequest(`user_states/${userId}`);
    return res && typeof res === 'object' ? res : null;
}

async function clearUserState(userId) {
    await firebaseRequest(`user_states/${userId}`, 'DELETE');
}

/*
|--------------------------------------------------------------------------
| UI KEYBOARDS (NO DUPLICATES, STYLED BUTTONS)
|--------------------------------------------------------------------------
*/
async function getUserMenu(userId) {
    const isAdm = await isAdmin(userId);
    const keyboard = [
        [
            { text: '👤 My Account', style: 'primary' },
            { text: '📮 Referral', style: 'success' }
        ],
        [
            { text: '💸 Withdraw', style: 'danger' },
            { text: '📜 History', style: 'primary' }
        ],
        [
            { text: '📊 System Status', style: 'success' }
        ]
    ];
    if (isAdm) {
        keyboard.push([
            { text: '🛠 Admin Panel', style: 'danger' }
        ]);
    }
    return { keyboard: keyboard, resize_keyboard: true, is_persistent: true };
}

async function getAdminMenu(superAdmin) {
    const botActive = await isBotActive();
    const wlMode = await isWhitelistOnlyMode();

    const keyboard = [
        [
            { text: botActive ? '🟢 Bot: Active (ON)' : '🔴 Bot: OFF (Maintenance)', style: botActive ? 'success' : 'danger' },
            { text: '⚙️ Central Settings', style: 'primary' }
        ],
        [
            { text: '👥 User & Balance', style: 'primary' },
            { text: '📢 Channel Broadcast', style: 'success' }
        ],
        [
            { text: '📢 Users Broadcast', style: 'primary' },
            { text: `🛡️ Security (${wlMode ? 'Whitelist Only' : 'Standard'})`, style: 'danger' }
        ],
        [
            { text: '📢 Force Channels', style: 'primary' },
            { text: '⭐ সেট Payouts Done', style: 'success' }
        ],
        [
            { text: '🔧 Source Settings', style: 'danger' }
        ]
    ];
    if (superAdmin) {
        keyboard.push([
            { text: '👮 এডমিন ম্যানেজমেন্ট', style: 'primary' }
        ]);
    }
    keyboard.push([
        { text: '🔙 Back to User Panel', style: 'danger' }
    ]);
    return { keyboard: keyboard, resize_keyboard: true, is_persistent: true };
}

function getCancelKeyboard() {
    return { keyboard: [[{ text: '/cancel', style: 'danger' }]], resize_keyboard: true, one_time_keyboard: true };
}

function centralSettingsKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '🎧 Support Bot Link', callback_data: 'cfg_support', style: 'primary' },
                { text: '💳 Payment Channel ID', callback_data: 'cfg_pay_channel', style: 'primary' }
            ],
            [
                { text: '🪙 Coin Name', callback_data: 'cfg_coin', style: 'success' },
                { text: '👥 Referral Reward', callback_data: 'cfg_referral', style: 'success' }
            ],
            [
                { text: '💰 Fixed Withdraw', callback_data: 'cfg_withdraw', style: 'danger' },
                { text: '🎯 1st Withdraw Refs', callback_data: 'cfg_first_refs', style: 'danger' }
            ],
            [
                { text: '🎁 Welcome Bonus', callback_data: 'cfg_welcome', style: 'primary' },
                { text: '📊 Withdraw Fee (%)', callback_data: 'cfg_fee', style: 'primary' }
            ]
        ]
    };
}

async function securityKeyboard() {
    const wlMode = await isWhitelistOnlyMode();
    return {
        inline_keyboard: [
            [
                { text: wlMode ? '🔒 Mode: Whitelist Only (Active)' : '🔓 Mode: Standard (All allowed)', callback_data: 'sec_toggle_wl_mode', style: wlMode ? 'danger' : 'success' }
            ],
            [
                { text: '🚫 Add Blacklist', callback_data: 'sec_add_bl', style: 'danger' },
                { text: '✅ Add Whitelist', callback_data: 'sec_add_wl', style: 'success' }
            ],
            [
                { text: '❌ Remove Blacklist', callback_data: 'sec_rem_bl', style: 'danger' },
                { text: '❌ Remove Whitelist', callback_data: 'sec_rem_wl', style: 'success' }
            ],
            [
                { text: '📋 Blacklist Users', callback_data: 'sec_list_bl', style: 'primary' },
                { text: '📋 Whitelist Users', callback_data: 'sec_list_wl', style: 'primary' }
            ]
        ]
    };
}

function adminManagementKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '➕ এডমিন যোগ করুন', callback_data: 'admin_add', style: 'success' },
                { text: '➖ এডমিন রিমুভ করুন', callback_data: 'admin_remove', style: 'danger' }
            ],
            [
                { text: '👮 এডমিন তালিকা', callback_data: 'admin_list', style: 'primary' }
            ]
        ]
    };
}

function forceJoinKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '➕ চ্যানেল যোগ করুন', callback_data: 'force_add', style: 'success' },
                { text: '➖ চ্যানেল রিমুভ করুন', callback_data: 'force_remove', style: 'danger' }
            ],
            [
                { text: '📋 চ্যানেল তালিকা', callback_data: 'force_list', style: 'primary' }
            ]
        ]
    };
}

function balanceKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '➕ ব্যালেন্স যোগ করুন', callback_data: 'balance_add', style: 'success' },
                { text: '➖ ব্যালেন্স কাটুন', callback_data: 'balance_cut', style: 'danger' }
            ]
        ]
    };
}

function withdrawActionKeyboard(withdrawId) {
    const claimUrl = `https://t.me/${BOT_USERNAME}?start=claim`;
    return {
        inline_keyboard: [
            [
                { text: '✅ Approve', callback_data: `withdraw_approve_${withdrawId}`, style: 'success' },
                { text: '❌ Reject', callback_data: `withdraw_reject_${withdrawId}`, style: 'danger' }
            ],
            [
                { text: '🎁 Claim 2 Star', url: claimUrl, style: 'primary' }
            ]
        ]
    };
}

function claimOnlyKeyboard() {
    const claimUrl = `https://t.me/${BOT_USERNAME}?start=claim`;
    return {
        inline_keyboard: [
            [{ text: '🎁 Claim 2 Star', url: claimUrl, style: 'success' }]
        ]
    };
}

/*
|--------------------------------------------------------------------------
| TELEGRAM CHANNEL STATUS & PARALLEL VERIFICATION
|--------------------------------------------------------------------------
*/
async function getTelegramUsername(userId) {
    const res = await telegramApi('getChat', { chat_id: userId });
    return res && res.ok && res.result?.username ? '@' + res.result.username : `@user_${userId}`;
}

async function isBotAdminInChat(chatId) {
    const botId = BOT_TOKEN.split(':')[0];
    const res = await telegramApi('getChatMember', { chat_id: chatId, user_id: botId });
    if (res && res.ok) {
        return ['administrator', 'creator'].includes(res.result?.status);
    }
    return false;
}

async function isJoinedChannel(channel, userId) {
    if (!channel) return false;
    const res = await telegramApi('getChatMember', { chat_id: channel, user_id: userId });
    if (!res || !res.ok) return false;
    const status = res.result?.status;
    if (['creator', 'administrator', 'member'].includes(status)) return true;
    if (status === 'restricted') return Boolean(res.result?.is_member);
    return false;
}

async function isUserJoinedAllChannels(userId, bypassCache = false) {
    const uidStr = String(userId);
    const now = Date.now();

    if (!bypassCache) {
        const cached = cache.userChannels.get(uidStr);
        if (cached && now < cached.expiresAt) {
            return cached.isMember;
        }
    }

    const forceChannels = await getAllForceChannels();
    const channels = Object.values(forceChannels).filter(ch => ch && ch.channel_id);

    if (!channels.length) {
        cache.userChannels.set(uidStr, { isMember: true, expiresAt: now + 30000 });
        return true;
    }

    const results = await Promise.all(channels.map(ch => isJoinedChannel(ch.channel_id, uidStr)));
    const allJoined = results.every(Boolean);

    cache.userChannels.set(uidStr, { isMember: allJoined, expiresAt: now + 30000 });
    return allJoined;
}

async function showForceJoin(chatId, firstName = 'User') {
    const forceChannels = await getAllForceChannels();
    const channelList = Object.values(forceChannels).filter(ch => ch && ch.channel_link);

    const inlineKeyboard = [];
    const total = channelList.length;

    for (let i = 0; i < total; i += 2) {
        if (i + 1 < total) {
            inlineKeyboard.push([
                { text: channelList[i].channel_name || 'Join', url: channelList[i].channel_link, style: 'primary' },
                { text: channelList[i + 1].channel_name || 'Join', url: channelList[i + 1].channel_link, style: 'danger' }
            ]);
        } else {
            inlineKeyboard.push([
                { text: channelList[i].channel_name || 'Join', url: channelList[i].channel_link, style: 'primary' }
            ]);
        }
    }

    inlineKeyboard.push([
        { text: 'Claim', callback_data: 'verify_join', style: 'success' }
    ]);

    const text =
        `👋 <b>Hello, ${escapeHtml(firstName)}!</b>\n\n` +
        `📢 <b>Join All Channels To Continue.</b>`;

    return await sendMessage(chatId, text, { inline_keyboard: inlineKeyboard });
}

/*
|--------------------------------------------------------------------------
| WITHDRAW ALERTS BUILDER
|--------------------------------------------------------------------------
*/
function buildPendingAlertText(withdraw, coinName) {
    return "🔔 <b>New Stars Request Pending Alert!</b>\n\n" +
        `📌 <b>User :</b> <code>${escapeHtml(withdraw.user_id)}</code>\n\n` +
        `💳 <b>Amount :</b> <b>${formatNumber(withdraw.amount)} ${escapeHtml(coinName)}</b> (Fee: ${formatNumber(withdraw.fee_percent)}%: \n` +
        `   After Fee <b>${formatNumber(withdraw.after_fee)} ${escapeHtml(coinName)}</b>)\n\n` +
        `📬 <b>Send To (Address):</b> <b>${escapeHtml(withdraw.withdraw_username)}</b>\n\n` +
        `🧾 <b>Transaction ID:</b> <code>${escapeHtml(withdraw.transaction_id)}</code>`;
}

function buildApprovedAlertText(withdraw, adminUsername, coinName) {
    return "✅ <b>Stars Request Approved!</b>\n\n" +
        `📌 <b>User :</b> <code>${escapeHtml(withdraw.user_id)}</code>\n\n` +
        `💳 <b>Amount :</b> <b>${formatNumber(withdraw.amount)} ${escapeHtml(coinName)}</b> (Fee: ${formatNumber(withdraw.fee_percent)}%: \n` +
        `   After Fee <b>${formatNumber(withdraw.after_fee)} ${escapeHtml(coinName)}</b>)\n\n` +
        `📬 <b>Send To (Address):</b> <b>${escapeHtml(withdraw.withdraw_username)}</b>\n\n` +
        `🧾 <b>Transaction ID:</b> <code>${escapeHtml(withdraw.transaction_id)}</code>\n` +
        `👮 <b>Approved By:</b> <b>${escapeHtml(adminUsername)}</b>`;
}

function buildRejectedAlertText(withdraw, adminUsername, coinName) {
    return "❌ <b>Stars Request Rejected!</b>\n\n" +
        `📌 <b>User :</b> <code>${escapeHtml(withdraw.user_id)}</code>\n\n` +
        `💳 <b>Amount :</b> <b>${formatNumber(withdraw.amount)} ${escapeHtml(coinName)}</b> (Refunded)\n\n` +
        `🧾 <b>Transaction ID:</b> <code>${escapeHtml(withdraw.transaction_id)}</code>\n` +
        `👮 <b>Rejected By:</b> <b>${escapeHtml(adminUsername)}</b>`;
}

/*
|--------------------------------------------------------------------------
| MAIN TELEGRAM UPDATE DISPATCHER
|--------------------------------------------------------------------------
*/
async function handleUpdate(update) {
    // -------------------------------------------------------------
    // 1. CALLBACK QUERY PROCESSING
    // -------------------------------------------------------------
    if (update.callback_query) {
        const callback = update.callback_query;
        const fromId = String(callback.from.id);
        const data = callback.data || '';
        const chatId = callback.message?.chat?.id;
        const messageId = callback.message?.message_id;

        // General Security & Maintenance Check
        const access = await checkUserAccess(fromId);
        if (!access.allowed) {
            if (access.reason === 'bot_off') {
                await answerCallback(callback.id, "⛔ Bot currently off!", true);
                await sendBotOffMessage(fromId);
            } else if (access.reason === 'blacklisted') {
                await answerCallback(callback.id, "⛔ Access Denied! You are blacklisted.", true);
            } else if (access.reason === 'whitelist_only') {
                await answerCallback(callback.id, "⛔ Whitelist Mode active! You are not authorized.", true);
            }
            return;
        }

        // Verify Channel Join Button
        if (data === 'verify_join') {
            await answerCallback(callback.id);
            invalidateUserCache(fromId);

            const joinedAll = await isUserJoinedAllChannels(fromId, true);
            if (!joinedAll) {
                if (chatId && messageId) {
                    try { await deleteMessage(chatId, messageId); } catch {}
                }
                await sendMessage(fromId, "⚠️ <b>Please join all channels first!</b>");
                await showForceJoin(fromId, callback.from.first_name);
                return;
            }

            let user = await getUser(fromId);
            const now = Math.floor(Date.now() / 1000);
            const coinName = await getSetting('coin_name', 'STAR');

            if (!user) {
                user = {
                    telegram_id: fromId,
                    first_name: callback.from.first_name || 'User',
                    username: callback.from.username || '',
                    balance: 0,
                    verification_status: 'verified',
                    is_verified: true,
                    created_at: now
                };
                await setUser(fromId, user);
            }

            const welcomeBonus = Number(await getSetting('welcome_bonus', 0));
            let newBalance = Number(user.balance || 0);
            const userUpdates = {
                verification_status: 'verified',
                is_verified: true,
                verified_at: now
            };

            if (!user.welcome_claimed && welcomeBonus > 0) {
                newBalance += welcomeBonus;
                userUpdates.balance = newBalance;
                userUpdates.welcome_claimed = true;
            }

            await updateUser(fromId, userUpdates);

            if (user.referred_by && !user.referral_rewarded) {
                const ref = await getUser(user.referred_by);
                if (ref) {
                    const refBonus = Number(await getSetting('referral_bonus', 1));
                    await updateUser(user.referred_by, {
                        balance: Number(ref.balance || 0) + refBonus,
                        total_referrals: Number(ref.total_referrals || 0) + 1
                    });
                    await updateUser(fromId, { referral_rewarded: true });
                    try {
                        await sendMessage(user.referred_by, `🎉 <b>New Referral Joined!</b>\n━━━━━━━━━━━━━━━━━━\n\n⭐ Bonus: <b>+${formatNumber(refBonus)} ${escapeHtml(coinName)}</b>\n👥 Total Referrals: <b>${Number(ref.total_referrals || 0) + 1}</b>`);
                    } catch {}
                }
            }

            if (chatId && messageId) {
                try { await deleteMessage(chatId, messageId); } catch {}
            }
            await sendMessage(fromId, `✅ <b>Verification Successful!</b>\n\nWelcome to ${escapeHtml(BOT_USERNAME)}! 🎉`, await getUserMenu(fromId));
            return;
        }

        // Withdraw Approve / Reject
        const match = data.match(/^withdraw_(approve|reject)_([A-Za-z0-9_-]+)$/);
        if (match) {
            await answerCallback(callback.id);
            if (!(await isAdmin(fromId))) {
                await sendMessage(fromId, "⛔ <b>Permission Denied!</b>");
                return;
            }
            const action = match[1];
            const withdrawId = match[2];
            const withdraw = await firebaseRequest(`withdrawals/${withdrawId}`);
            const coinName = await getSetting('coin_name', 'STAR');

            if (!withdraw || withdraw.status !== 'pending') {
                await sendMessage(fromId, "⚠️ <b>Request already processed!</b>");
                return;
            }

            const adminUsername = await getTelegramUsername(fromId);
            const now = Math.floor(Date.now() / 1000);

            if (action === 'approve') {
                await firebaseRequest(`withdrawals/${withdrawId}`, 'PATCH', {
                    status: 'approved',
                    processed_by: fromId,
                    processed_by_username: adminUsername,
                    processed_at: now
                });
                
                await updateUser(withdraw.user_id, { has_withdrawn: true });
                await sendMessage(withdraw.user_id, `🎉 <b>Withdrawal Approved!</b>\n\n💰 Amount: <b>${formatNumber(withdraw.after_fee)} ${escapeHtml(coinName)}</b>\n🧾 ID: <code>${withdraw.transaction_id}</code>`);

                if (chatId && messageId) {
                    await editMessageText(chatId, messageId, buildApprovedAlertText(withdraw, adminUsername, coinName), claimOnlyKeyboard());
                }
                return;
            }

            if (action === 'reject') {
                const target = await getUser(withdraw.user_id);
                if (target) {
                    await updateUser(withdraw.user_id, {
                        balance: Number(target.balance || 0) + Number(withdraw.amount || 0)
                    });
                }
                await firebaseRequest(`withdrawals/${withdrawId}`, 'PATCH', {
                    status: 'rejected',
                    processed_by: fromId,
                    processed_by_username: adminUsername,
                    processed_at: now,
                    refunded: true
                });
                await sendMessage(withdraw.user_id, `❌ <b>Withdrawal Rejected</b>\n\n${formatNumber(withdraw.amount)} ${escapeHtml(coinName)} has been refunded to your balance.`);

                if (chatId && messageId) {
                    await editMessageText(chatId, messageId, buildRejectedAlertText(withdraw, adminUsername, coinName), claimOnlyKeyboard());
                }
                return;
            }
        }

        // ---------------------------------------------------------
        // ADMIN CALLBACK ACTIONS
        // ---------------------------------------------------------
        if (await isAdmin(fromId)) {
            // CENTRAL SETTINGS CALLBACKS
            if (data === 'cfg_support') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'cfg_support');
                const cur = await getSetting('support_url', DEFAULT_SUPPORT_URL);
                await sendMessage(fromId, `🎧 <b>Support Bot / Admin Link</b>\n\nবর্তমান লিংক: <code>${escapeHtml(cur)}</code>\n\nনতুন লিংক পাঠান (যেমন: <code>https://t.me/AuraSupportsBot</code>):`, getCancelKeyboard());
                return;
            }

            if (data === 'cfg_pay_channel') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'cfg_pay_channel');
                const cur = await getSetting('withdraw_request_channel', DEFAULT_PAYMENT_CHANNEL_ID);
                await sendMessage(fromId, `💳 <b>Withdraw Payment Channel ID</b>\n\nবর্তমান আইডি: <code>${escapeHtml(cur)}</code>\n\nনতুন Channel ID পাঠান (যেমন: <code>-1003945593094</code>):`, getCancelKeyboard());
                return;
            }

            if (data === 'cfg_coin') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'cfg_coin');
                const cur = await getSetting('coin_name', 'STAR');
                await sendMessage(fromId, `🪙 <b>Coin / Currency Name</b>\n\nবর্তমান কারেন্সি: <b>${escapeHtml(cur)}</b>\n\nনতুন নাম পাঠান (যেমন: STAR, COIN, BDT):`, getCancelKeyboard());
                return;
            }

            if (data === 'cfg_referral') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'cfg_referral');
                const cur = await getSetting('referral_bonus', 1);
                const coin = await getSetting('coin_name', 'STAR');
                await sendMessage(fromId, `👥 <b>Referral Reward</b>\n\nবর্তমান রিওয়ার্ড: <b>${formatNumber(cur)} ${escapeHtml(coin)}</b>\n\nনতুন Amount পাঠান:`, getCancelKeyboard());
                return;
            }

            if (data === 'cfg_withdraw') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'cfg_withdraw');
                const cur = await getSetting('min_withdraw', 2);
                const coin = await getSetting('coin_name', 'STAR');
                await sendMessage(fromId, `💰 <b>Fixed Minimum Withdraw</b>\n\nবর্তমান ফিক্সড উইথড্র: <b>${formatNumber(cur)} ${escapeHtml(coin)}</b>\n\nনতুন Amount পাঠান:`, getCancelKeyboard());
                return;
            }

            if (data === 'cfg_first_refs') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'cfg_first_refs');
                const cur = await getSetting('first_withdraw_refs', 3);
                await sendMessage(fromId, `🎯 <b>First Withdraw Referral Requirement</b>\n\nবর্তমানে প্রথম উইথড্র করতে রেফার প্রয়োজন: <b>${cur} টি</b>\n\nনতুন সংখ্যা লিখুন (শর্ত তুলে নিতে 0 লিখুন):`, getCancelKeyboard());
                return;
            }

            if (data === 'cfg_welcome') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'cfg_welcome');
                const cur = await getSetting('welcome_bonus', 0);
                const coin = await getSetting('coin_name', 'STAR');
                await sendMessage(fromId, `🎁 <b>Welcome Bonus</b>\n\nবর্তমান বোনাস: <b>${formatNumber(cur)} ${escapeHtml(coin)}</b>\n\nনতুন Amount পাঠান:`, getCancelKeyboard());
                return;
            }

            if (data === 'cfg_fee') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'cfg_fee');
                const cur = await getSetting('withdraw_fee_percent', 0);
                await sendMessage(fromId, `📊 <b>Withdrawal Fee (%)</b>\n\nবর্তমান ফি: <b>${formatNumber(cur)}%</b>\n\nনতুন পার্সেন্টেজ পাঠান (0-100):`, getCancelKeyboard());
                return;
            }

            // SECURITY: TOGGLE WHITELIST-ONLY MODE
            if (data === 'sec_toggle_wl_mode') {
                const curMode = await isWhitelistOnlyMode();
                const newMode = curMode ? 'off' : 'on';
                await setSetting('whitelist_only_mode', newMode);
                invalidateSecurityCache();
                await answerCallback(callback.id, `Whitelist Mode: ${newMode.toUpperCase()}`);
                if (chatId && messageId) {
                    await editMessageText(chatId, messageId, "🛡️ <b>Security Management</b>\nমোবাইল সিকিউরিটির মতো ব্লকলিস্ট ও হোয়াইটলিস্ট কন্ট্রোল:", await securityKeyboard());
                }
                return;
            }

            // SECURITY: ADD / REMOVE BLACKLIST & WHITELIST
            if (data === 'sec_add_bl') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'sec_add_bl');
                await sendMessage(fromId, "🚫 <b>Add to Blacklist</b>\n\nইউজারের Telegram User ID পাঠান:", getCancelKeyboard());
                return;
            }

            if (data === 'sec_add_wl') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'sec_add_wl');
                await sendMessage(fromId, "✅ <b>Add to Whitelist</b>\n\nইউজারের Telegram User ID পাঠান:", getCancelKeyboard());
                return;
            }

            if (data === 'sec_rem_bl') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'sec_rem_bl');
                await sendMessage(fromId, "❌ <b>Remove from Blacklist</b>\n\nরিমুভ করতে Telegram User ID পাঠান:", getCancelKeyboard());
                return;
            }

            if (data === 'sec_rem_wl') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'sec_rem_wl');
                await sendMessage(fromId, "❌ <b>Remove from Whitelist</b>\n\nরিমুভ করতে Telegram User ID পাঠান:", getCancelKeyboard());
                return;
            }

            if (data === 'sec_list_bl') {
                await answerCallback(callback.id);
                const bl = await getBlacklist();
                const ids = Object.keys(bl);
                let txt = `🚫 <b>Blacklist Users (${ids.length})</b>\n━━━━━━━━━━━━━━━━━━\n`;
                if (!ids.length) txt += "বর্তমানে কোনো ইউজার ব্ল্যাকলিস্টে নেই।";
                else txt += ids.map(id => `• <code>${escapeHtml(id)}</code>`).join('\n');
                await sendLongMessage(fromId, txt);
                return;
            }

            if (data === 'sec_list_wl') {
                await answerCallback(callback.id);
                const wl = await getWhitelist();
                const ids = Object.keys(wl);
                let txt = `✅ <b>Whitelist Users (${ids.length})</b>\n━━━━━━━━━━━━━━━━━━\n`;
                if (!ids.length) txt += "বর্তমানে কোনো ইউজার হোয়াইটলিস্টে নেই।";
                else txt += ids.map(id => `• <code>${escapeHtml(id)}</code>`).join('\n');
                await sendLongMessage(fromId, txt);
                return;
            }

            // BROADCAST: SINGLE CHANNEL SELECTION
            const bcChMatch = data.match(/^bc_select_channel_([A-Za-z0-9_-]+)$/);
            if (bcChMatch) {
                await answerCallback(callback.id);
                const chKey = bcChMatch[1];
                const channels = await getAllForceChannels();
                const target = channels[chKey];

                if (!target) {
                    await sendMessage(fromId, "⚠️ চ্যানেলটি পাওয়া যায়নি!");
                    return;
                }

                await setAdminState(fromId, 'awaiting_channel_single_msg', {
                    target_channel_id: target.channel_id,
                    target_channel_name: target.channel_name || 'Channel'
                });

                await sendMessage(fromId, `📢 <b>Selected Channel: ${escapeHtml(target.channel_name)}</b>\n\nশুধুমাত্র এই চ্যানেলে ব্রডকাস্ট করার জন্য মেসেজটি পাঠান (Text, Media, Forward):`, getCancelKeyboard());
                return;
            }

            if (data === 'bc_all_channels') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'awaiting_channel_broadcast_message');
                await sendMessage(fromId, `📢 <b>Broadcast to ALL Channels</b>\n\nসকল ফোর্স চ্যানেলে একসাথে পোস্ট করার জন্য মেসেজটি পাঠান:`, getCancelKeyboard());
                return;
            }

            // BROADCAST CONFIRMATION
            if (data === 'confirm_broadcast_single_ch') {
                await answerCallback(callback.id);
                const aState = await getAdminState(fromId);
                if (!aState || aState.action !== 'confirm_broadcast_single_ch') {
                    await sendMessage(fromId, "⚠️ <b>Session Expired!</b>");
                    return;
                }
                await clearAdminState(fromId);
                if (chatId && messageId) await deleteMessage(chatId, messageId);

                const res = await copyMessage(aState.target_channel_id, aState.from_chat_id, aState.message_id);
                if (res && res.ok) {
                    const bId = `bc_single_${Date.now()}`;
                    await firebaseRequest(`broadcast_history/${bId}`, 'PUT', {
                        type: 'single_channel',
                        sent: { [aState.target_channel_id]: res.result.message_id },
                        created_at: Math.floor(Date.now() / 1000)
                    });

                    const deleteKeyboard = {
                        inline_keyboard: [
                            [{ text: '🗑️ Delete Broadcast', callback_data: `delete_bc_${bId}`, style: 'danger' }]
                        ]
                    };
                    await sendMessage(chatId, `✅ <b>সফলভাবে ${escapeHtml(aState.target_channel_name)} চ্যানেলে ব্রডকাস্ট সম্পন্ন হয়েছে!</b>`, deleteKeyboard);
                } else {
                    await sendMessage(chatId, `❌ <b>পোস্ট ব্যর্থ হয়েছে!</b>\nকারণ: <code>${escapeHtml(res?.description || 'Unknown error / Not admin')}</code>`, await getAdminMenu(isSuperAdmin(fromId)));
                }
                return;
            }

            if (data === 'confirm_broadcast_users') {
                await answerCallback(callback.id);
                const aState = await getAdminState(fromId);
                if (!aState || aState.action !== 'confirm_broadcast_users') {
                    await sendMessage(fromId, "⚠️ <b>Session Expired!</b>");
                    return;
                }
                await clearAdminState(fromId);
                if (chatId && messageId) await deleteMessage(chatId, messageId);

                await sendMessage(chatId, "🚀 <b>ইউজার ব্রডকাস্ট শুরু হচ্ছে...</b>");

                const users = await getAllUsers();
                let success = 0, failed = 0;
                const sentRecords = {};

                for (const uid of Object.keys(users)) {
                    try {
                        const res = await copyMessage(uid, aState.from_chat_id, aState.message_id);
                        if (res && res.ok && res.result?.message_id) {
                            success++;
                            sentRecords[uid] = res.result.message_id;
                        } else {
                            failed++;
                        }
                    } catch {
                        failed++;
                    }
                }

                const bId = `bc_${Date.now()}`;
                await firebaseRequest(`broadcast_history/${bId}`, 'PUT', {
                    type: 'users',
                    sent: sentRecords,
                    created_at: Math.floor(Date.now() / 1000)
                });

                const deleteKeyboard = {
                    inline_keyboard: [
                        [{ text: '🗑️ Delete Broadcast', callback_data: `delete_bc_${bId}`, style: 'danger' }]
                    ]
                };

                await sendMessage(chatId, `📢 <b>User Broadcast Completed!</b>\n\n✅ সফল: <b>${success}</b>\n❌ ব্যর্থ: <b>${failed}</b>`, deleteKeyboard);
                return;
            }

            if (data === 'confirm_broadcast_channels') {
                await answerCallback(callback.id);
                const aState = await getAdminState(fromId);
                if (!aState || aState.action !== 'confirm_broadcast_channels') {
                    await sendMessage(fromId, "⚠️ <b>Session Expired!</b>");
                    return;
                }
                await clearAdminState(fromId);
                if (chatId && messageId) await deleteMessage(chatId, messageId);

                const channels = await getAllForceChannels();
                const channelList = Object.values(channels).filter(ch => ch && ch.channel_id);

                let success = 0, failed = 0;
                const sentRecords = {};
                let reportDetails = '';

                for (const ch of channelList) {
                    const cName = ch.channel_name || ch.channel_id;
                    try {
                        const res = await copyMessage(ch.channel_id, aState.from_chat_id, aState.message_id);
                        if (res && res.ok && res.result?.message_id) {
                            success++;
                            sentRecords[ch.channel_id] = res.result.message_id;
                            reportDetails += `\n✅ <b>${escapeHtml(cName)}</b>: সফল!`;
                        } else {
                            failed++;
                            reportDetails += `\n❌ <b>${escapeHtml(cName)}</b>: <code>${escapeHtml(res?.description || 'Error')}</code>`;
                        }
                    } catch (err) {
                        failed++;
                        reportDetails += `\n❌ <b>${escapeHtml(cName)}</b>: <code>${escapeHtml(err.message || 'Error')}</code>`;
                    }
                }

                const bId = `bc_ch_${Date.now()}`;
                await firebaseRequest(`broadcast_history/${bId}`, 'PUT', {
                    type: 'channels',
                    sent: sentRecords,
                    created_at: Math.floor(Date.now() / 1000)
                });

                const summaryMessage =
                    `📢 <b>চ্যানেল ব্রডকাস্ট রিপোর্ট</b>\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `✅ <b>সফল:</b> <b>${success}</b>\n` +
                    `❌ <b>ব্যর্থ:</b> <b>${failed}</b>\n\n` +
                    `📋 <b>বিস্তারিত:</b>\n${reportDetails}`;

                const deleteKeyboard = {
                    inline_keyboard: [
                        [{ text: '🗑️ Delete Channel Broadcast', callback_data: `delete_bc_${bId}`, style: 'danger' }]
                    ]
                };

                await sendLongMessage(chatId, summaryMessage, deleteKeyboard);
                return;
            }

            if (data === 'cancel_broadcast') {
                await answerCallback(callback.id);
                await clearAdminState(fromId);
                if (chatId && messageId) await deleteMessage(chatId, messageId);
                await sendMessage(chatId, "❌ ব্রডকাস্ট বাতিল করা হয়েছে।", await getAdminMenu(isSuperAdmin(fromId)));
                return;
            }

            const delMatch = data.match(/^delete_bc_(bc_[A-Za-z0-9_]+)$/);
            if (delMatch) {
                await answerCallback(callback.id);
                const bId = delMatch[1];
                const bcData = await firebaseRequest(`broadcast_history/${bId}`);
                if (!bcData || !bcData.sent) {
                    await sendMessage(fromId, "⚠️ <b>ইতিমধ্যে ডিলিট করা হয়েছে!</b>");
                    return;
                }

                let delCount = 0;
                for (const [targetChat, targetMsgId] of Object.entries(bcData.sent)) {
                    try {
                        const delRes = await deleteMessage(targetChat, targetMsgId);
                        if (delRes && delRes.ok) delCount++;
                    } catch {}
                }

                await firebaseRequest(`broadcast_history/${bId}`, 'DELETE');
                if (chatId && messageId) await deleteMessage(chatId, messageId);
                await sendMessage(chatId, `🗑️ <b>${delCount} টি প্রেরিত মেসেজ মুছে ফেলা হয়েছে!</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                return;
            }

            // ADMIN MANAGEMENT
            if (data === 'admin_add' && isSuperAdmin(fromId)) {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'admin_add');
                await sendMessage(fromId, "➕ <b>নতুন এডমিন যোগ করুন</b>\n\nTelegram User ID পাঠান:", getCancelKeyboard());
                return;
            }

            if (data === 'admin_remove' && isSuperAdmin(fromId)) {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'admin_remove');
                await sendMessage(fromId, "➖ <b>এডমিন রিমুভ করুন</b>\n\nTelegram User ID পাঠান:", getCancelKeyboard());
                return;
            }

            if (data === 'admin_list' && isSuperAdmin(fromId)) {
                await answerCallback(callback.id);
                const admins = await getAllAdmins();
                let list = `👮 <b>এডমিন তালিকা</b>\n━━━━━━━━━━━━━━━━━━\n\n👑 <b>Super Admin:</b> <code>${SUPER_ADMIN_ID}</code>\n\n👮 <b>অন্যান্য Admin:</b>\n`;
                let has = false;
                for (const [aId, a] of Object.entries(admins)) {
                    if (a && a.active) { has = true; list += `• <code>${escapeHtml(aId)}</code>\n`; }
                }
                if (!has) list += "কোনো অতিরিক্ত Admin নেই।";
                await sendMessage(fromId, list);
                return;
            }

            // FORCE CHANNELS
            if (data === 'force_add') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'add_force_channel_id');
                await sendMessage(fromId, "➕ <b>ফোর্স চ্যানেল যোগ করুন</b>\n\nChannel ID পাঠান (যেমন: <code>-1003945593094</code>):", getCancelKeyboard());
                return;
            }

            if (data === 'force_remove') {
                await answerCallback(callback.id);
                const channels = await getAllForceChannels();
                if (!Object.keys(channels).length) {
                    await sendMessage(fromId, "⚠️ <b>কোনো Channel তালিকায় নেই!</b>");
                    return;
                }
                const kb = [];
                for (const [k, c] of Object.entries(channels)) {
                    if (c) kb.push([{ text: `❌ ${c.channel_name || 'Channel'}`, callback_data: `removeforce_${k}`, style: 'danger' }]);
                }
                await sendMessage(fromId, "📢 <b>ফোর্স চ্যানেল রিমুভ</b>\n\nChannel নির্বাচন করুন:", { inline_keyboard: kb });
                return;
            }

            const removeMatch = data.match(/^removeforce_([A-Za-z0-9_-]+)$/);
            if (removeMatch) {
                await answerCallback(callback.id);
                await firebaseRequest(`force_channels/${removeMatch[1]}`, 'DELETE');
                invalidateForceChannelsCache();
                cache.userChannels.clear();
                await sendMessage(fromId, "✅ <b>চ্যানেল রিমুভ সম্পন্ন!</b>", await getAdminMenu(isSuperAdmin(fromId)));
                return;
            }

            if (data === 'force_list') {
                await answerCallback(callback.id);
                const channels = await getAllForceChannels();
                let list = "📢 <b>ফোর্স চ্যানেল তালিকা</b>\n━━━━━━━━━━━━━━━━━━\n";
                if (!Object.keys(channels).length) list += "\nকোনো Force Join Channel নেই।";
                else {
                    for (const [k, c] of Object.entries(channels)) {
                        if (c) list += `\n\n🔹 <b>${escapeHtml(c.channel_name || '')}</b>\n🆔 ID: <code>${escapeHtml(c.channel_id || '')}</code>\n🔗 Link: <code>${escapeHtml(c.channel_link || '')}</code>`;
                    }
                }
                await sendLongMessage(fromId, list);
                return;
            }

            // USER BALANCE MANUAL EDIT
            if (data === 'balance_add') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'add_balance_user');
                await sendMessage(fromId, "➕ <b>ব্যালেন্স যোগ</b>\n\n👤 Telegram User ID পাঠান:", getCancelKeyboard());
                return;
            }

            if (data === 'balance_cut') {
                await answerCallback(callback.id);
                await setAdminState(fromId, 'cut_balance_user');
                await sendMessage(fromId, "➖ <b>ব্যালেন্স কাটুন</b>\n\n👤 Telegram User ID পাঠান:", getCancelKeyboard());
                return;
            }
        }
    }

    // -------------------------------------------------------------
    // 2. MESSAGE UPDATES
    // -------------------------------------------------------------
    if (update.message) {
        const msg = update.message;
        const fromId = String(msg.from.id).trim();
        const chatId = String(msg.chat.id);
        const text = normalizeText(msg.text || '');
        const isAdm = await isAdmin(fromId);

        // Security & Maintenance Check
        const access = await checkUserAccess(fromId);
        if (!access.allowed) {
            if (access.reason === 'bot_off') {
                await sendBotOffMessage(chatId);
            } else if (access.reason === 'blacklisted') {
                await sendMessage(chatId, "⛔ <b>Access Denied!</b>\nYour account has been restricted by administrator.");
            } else if (access.reason === 'whitelist_only') {
                await sendMessage(chatId, "⛔ <b>Access Restricted!</b>\nOnly whitelisted members are currently allowed to use this bot.");
            }
            return;
        }

        let user = await getUser(fromId);
        if (!user) {
            let refBy = null;
            if (text) {
                const startMatch = text.match(/^\/start\s+(\d+)$/i);
                if (startMatch && startMatch[1] !== fromId && (await getUser(startMatch[1]))) {
                    refBy = startMatch[1];
                }
            }
            user = {
                telegram_id: fromId,
                first_name: msg.from.first_name || 'User',
                username: msg.from.username || '',
                balance: 0,
                referred_by: refBy,
                verification_status: isAdm ? 'verified' : 'pending_channel',
                is_verified: isAdm,
                created_at: Math.floor(Date.now() / 1000)
            };
            await setUser(fromId, user);
        }

        if (text && text.toLowerCase() === '/cancel') {
            await clearAdminState(fromId);
            await clearUserState(fromId);
            await sendMessage(chatId, "❌ Cancelled.", await getUserMenu(fromId));
            return;
        }

        // Fast Force Join Verification
        if (!isAdm) {
            const joinedAll = await isUserJoinedAllChannels(fromId);
            if (!joinedAll) {
                await showForceJoin(chatId, msg.from.first_name);
                return;
            }
        }

        // ---------------------------------------------------------
        // ADMIN STATES HANDLING
        // ---------------------------------------------------------
        if (isAdm) {
            const aState = await getAdminState(fromId);

            // Single Channel Broadcast
            if (aState && aState.action === 'awaiting_channel_single_msg') {
                await setAdminState(fromId, 'confirm_broadcast_single_ch', {
                    from_chat_id: chatId,
                    message_id: msg.message_id,
                    target_channel_id: aState.target_channel_id,
                    target_channel_name: aState.target_channel_name
                });

                await copyMessage(chatId, chatId, msg.message_id);

                const confirmKb = {
                    inline_keyboard: [
                        [
                            { text: `✅ Send to ${aState.target_channel_name}`, callback_data: 'confirm_broadcast_single_ch', style: 'success' },
                            { text: '❌ Cancel', callback_data: 'cancel_broadcast', style: 'danger' }
                        ]
                    ]
                };

                await sendMessage(chatId, `👆 <b>প্রিভিউ মেসেজটি দেখুন।</b>\nআপনি কি শুধুমাত্র <b>${escapeHtml(aState.target_channel_name)}</b> চ্যানেলে এটি পাঠাতে চান?`, confirmKb);
                return;
            }

            // User Broadcast
            if (aState && aState.action === 'awaiting_broadcast_message') {
                await setAdminState(fromId, 'confirm_broadcast_users', {
                    from_chat_id: chatId,
                    message_id: msg.message_id
                });

                await copyMessage(chatId, chatId, msg.message_id);

                const confirmKb = {
                    inline_keyboard: [
                        [
                            { text: '✅ Send to All Users', callback_data: 'confirm_broadcast_users', style: 'success' },
                            { text: '❌ Cancel', callback_data: 'cancel_broadcast', style: 'danger' }
                        ]
                    ]
                };

                await sendMessage(chatId, "👆 <b>প্রিভিউ মেসেজটি দেখুন।</b>\nআপনি কি এই মেসেজটি <b>সকল ইউজারের কাছে</b> পাঠাতে চান?", confirmKb);
                return;
            }

            // All Channels Broadcast
            if (aState && aState.action === 'awaiting_channel_broadcast_message') {
                await setAdminState(fromId, 'confirm_broadcast_channels', {
                    from_chat_id: chatId,
                    message_id: msg.message_id
                });

                await copyMessage(chatId, chatId, msg.message_id);

                const confirmKb = {
                    inline_keyboard: [
                        [
                            { text: '✅ Send to All Channels', callback_data: 'confirm_broadcast_channels', style: 'success' },
                            { text: '❌ Cancel', callback_data: 'cancel_broadcast', style: 'danger' }
                        ]
                    ]
                };

                await sendMessage(chatId, "👆 <b>প্রিভিউ মেসেজটি দেখুন।</b>\nআপনি কি এই মেসেজটি <b>সকল চ্যানেলে</b> পাঠাতে চান?", confirmKb);
                return;
            }

            // Admin Settings Text Inputs
            if (aState && aState.action && text) {
                const act = aState.action;

                if (act === 'cfg_support') {
                    let link = text.trim();
                    if (link.startsWith('@')) link = 'https://t.me/' + link.slice(1);
                    await setSetting('support_url', link);
                    invalidateSettingsCache('support_url');
                    await clearAdminState(fromId);
                    await sendMessage(chatId, `✅ <b>Support Bot Link Updated:</b>\n<code>${escapeHtml(link)}</code>`, await getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (act === 'cfg_pay_channel') {
                    await setSetting('withdraw_request_channel', text.trim());
                    invalidateSettingsCache('withdraw_request_channel');
                    await clearAdminState(fromId);
                    await sendMessage(chatId, `✅ <b>Withdraw Payment Channel ID Updated: ${escapeHtml(text.trim())}</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (act === 'cfg_coin') {
                    await setSetting('coin_name', text.trim().toUpperCase());
                    invalidateSettingsCache('coin_name');
                    await clearAdminState(fromId);
                    await sendMessage(chatId, `✅ <b>Coin Name Updated: ${escapeHtml(text.trim().toUpperCase())}</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (act === 'cfg_referral') {
                    if (isNumericAmount(text) && Number(text) >= 0) {
                        await setSetting('referral_bonus', Number(text));
                        invalidateSettingsCache('referral_bonus');
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>Referral Bonus Updated: ${formatNumber(text)}</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক সংখ্যা লিখুন:", getCancelKeyboard());
                    }
                    return;
                }

                if (act === 'cfg_withdraw') {
                    if (isNumericAmount(text) && Number(text) > 0) {
                        await setSetting('min_withdraw', Number(text));
                        invalidateSettingsCache('min_withdraw');
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>Fixed Withdraw Amount Updated: ${formatNumber(text)}</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক সংখ্যা লিখুন:", getCancelKeyboard());
                    }
                    return;
                }

                if (act === 'cfg_first_refs') {
                    if (/^\d+$/.test(text)) {
                        await setSetting('first_withdraw_refs', parseInt(text));
                        invalidateSettingsCache('first_withdraw_refs');
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>First Withdraw Referral Requirement: ${text} Refs</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক পূর্ণসংখ্যা দিন (যেমন: 3):", getCancelKeyboard());
                    }
                    return;
                }

                if (act === 'cfg_welcome') {
                    if (isNumericAmount(text) && Number(text) >= 0) {
                        await setSetting('welcome_bonus', Number(text));
                        invalidateSettingsCache('welcome_bonus');
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>Welcome Bonus Updated: ${formatNumber(text)}</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক সংখ্যা লিখুন:", getCancelKeyboard());
                    }
                    return;
                }

                if (act === 'cfg_fee') {
                    if (isNumericAmount(text) && Number(text) >= 0 && Number(text) <= 100) {
                        await setSetting('withdraw_fee_percent', Number(text));
                        invalidateSettingsCache('withdraw_fee_percent');
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>Withdrawal Fee Updated: ${formatNumber(text)}%</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                    } else {
                        await sendMessage(chatId, "❌ 0 থেকে 100 এর মধ্যে সংখ্যা দিন:", getCancelKeyboard());
                    }
                    return;
                }

                // SECURITY INPUTS
                if (act === 'sec_add_bl') {
                    if (/^\d+$/.test(text)) {
                        await firebaseRequest(`security/blacklist/${text}`, 'PUT', { added_by: fromId, added_at: Math.floor(Date.now() / 1000) });
                        invalidateSecurityCache();
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `🚫 <b>User ${text} সফলভাবে Blacklist করা হয়েছে!</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক Numeric User ID দিন:", getCancelKeyboard());
                    }
                    return;
                }

                if (act === 'sec_rem_bl') {
                    if (/^\d+$/.test(text)) {
                        await firebaseRequest(`security/blacklist/${text}`, 'DELETE');
                        invalidateSecurityCache();
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>User ${text}-কে Blacklist থেকে রিমুভ করা হয়েছে!</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক Numeric User ID দিন:", getCancelKeyboard());
                    }
                    return;
                }

                if (act === 'sec_add_wl') {
                    if (/^\d+$/.test(text)) {
                        await firebaseRequest(`security/whitelist/${text}`, 'PUT', { added_by: fromId, added_at: Math.floor(Date.now() / 1000) });
                        invalidateSecurityCache();
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>User ${text} সফলভাবে Whitelist করা হয়েছে!</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক Numeric User ID দিন:", getCancelKeyboard());
                    }
                    return;
                }

                if (act === 'sec_rem_wl') {
                    if (/^\d+$/.test(text)) {
                        await firebaseRequest(`security/whitelist/${text}`, 'DELETE');
                        invalidateSecurityCache();
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `❌ <b>User ${text}-কে Whitelist থেকে রিমুভ করা হয়েছে!</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক Numeric User ID দিন:", getCancelKeyboard());
                    }
                    return;
                }

                // PAYOUTS DONE & SOURCE
                if (act === 'set_payouts_done') {
                    if (isNumericAmount(text) && Number(text) >= 0) {
                        const formatted = formatNumber(Number(text));
                        await setSetting('custom_payouts_done', formatted);
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>Payouts Done সেট করা হয়েছে:</b> <b>${formatted}</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক সংখ্যা পাঠান:", getCancelKeyboard());
                    }
                    return;
                }

                if (act === 'set_source_info') {
                    const parts = text.split('|').map(s => s.trim());
                    const sName = parts[0] || DEVELOPER_NAME;
                    const sLink = parts[1] || DEVELOPER_LINK;

                    await setSetting('source_name', sName);
                    await setSetting('source_link', sLink);
                    await clearAdminState(fromId);
                    await sendMessage(chatId, `✅ <b>Source Updated!</b>\n\n🔧 ${escapeHtml(sName)}\n🔗 ${escapeHtml(sLink)}`, await getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                // ADMIN & FORCE CHANNELS
                if (act === 'admin_add') {
                    if (/^\d+$/.test(text)) {
                        await firebaseRequest(`admins/${text}`, 'PUT', { active: true, added_by: fromId, added_at: Math.floor(Date.now() / 1000) });
                        cache.admins = null;
                        await clearAdminState(fromId);
                        await sendMessage(chatId, "🎉 <b>Admin Added Successfully!</b>", await getAdminMenu(true));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক Numeric ID দিন:", getCancelKeyboard());
                    }
                    return;
                }

                if (act === 'admin_remove') {
                    if (/^\d+$/.test(text) && !isSuperAdmin(text)) {
                        await firebaseRequest(`admins/${text}`, 'DELETE');
                        cache.admins = null;
                        await clearAdminState(fromId);
                        await sendMessage(chatId, "✅ <b>Admin Removed Successfully!</b>", await getAdminMenu(true));
                    } else {
                        await sendMessage(chatId, "❌ Super Admin রিমুভ করা যাবে না:", getCancelKeyboard());
                    }
                    return;
                }

                if (act === 'add_force_channel_id') {
                    if (/^-100\d+$/.test(text)) {
                        await setAdminState(fromId, 'add_force_channel_link', { channel_id: text });
                        await sendMessage(chatId, "🔗 <b>Channel Link দিন:</b>\n\nExample: <code>https://t.me/AuraPaymentChannel</code>", getCancelKeyboard());
                    } else {
                        await sendMessage(chatId, "❌ সঠিক Channel ID দিন:", getCancelKeyboard());
                    }
                    return;
                }

                if (act === 'add_force_channel_link') {
                    let link = text.trim();
                    if (link.startsWith('@')) link = 'https://t.me/' + link.slice(1);
                    await setAdminState(fromId, 'add_force_channel_name', { channel_id: aState.channel_id, channel_link: link });
                    await sendMessage(chatId, "🔘 <b>Button Name দিন (যেমন: Join):</b>", getCancelKeyboard());
                    return;
                }

                if (act === 'add_force_channel_name') {
                    await firebaseRequest('force_channels', 'POST', {
                        channel_id: aState.channel_id,
                        channel_link: aState.channel_link,
                        channel_name: text,
                        added_by: fromId,
                        added_at: Math.floor(Date.now() / 1000)
                    });
                    invalidateForceChannelsCache();
                    cache.userChannels.clear();
                    await clearAdminState(fromId);
                    await sendMessage(chatId, "🎉 <b>Force Join Channel Added!</b>", await getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (act === 'add_balance_user') {
                    if (!/^\d+$/.test(text)) {
                        await sendMessage(chatId, "❌ সঠিক User ID দিন:", getCancelKeyboard());
                        return;
                    }
                    const target = await getUser(text);
                    if (!target) {
                        await sendMessage(chatId, "❌ ইউজার পাওয়া যায়নি!", getCancelKeyboard());
                        return;
                    }
                    const coin = await getSetting('coin_name', 'STAR');
                    await setAdminState(fromId, 'add_balance_amount', { target_id: text });
                    await sendMessage(chatId, `👤 <b>${escapeHtml(target.first_name || 'User')}</b>\n💰 ব্যালেন্স: <b>${formatNumber(target.balance || 0)} ${escapeHtml(coin)}</b>\n\nকত যোগ করতে চান?`, getCancelKeyboard());
                    return;
                }

                if (act === 'add_balance_amount') {
                    if (!isNumericAmount(text) || Number(text) <= 0) {
                        await sendMessage(chatId, "❌ সঠিক Amount দিন:", getCancelKeyboard());
                        return;
                    }
                    const amt = Number(text);
                    const targetUser = await getUser(aState.target_id);
                    const coin = await getSetting('coin_name', 'STAR');
                    if (targetUser) {
                        const newBal = Number(targetUser.balance || 0) + amt;
                        await updateUser(aState.target_id, { balance: newBal });
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>Added +${formatNumber(amt)} ${escapeHtml(coin)}</b>\n💰 New Balance: <b>${formatNumber(newBal)} ${escapeHtml(coin)}</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                        try {
                            await sendMessage(aState.target_id, `🎁 <b>+${formatNumber(amt)} ${escapeHtml(coin)} added to your balance!</b>\n💰 Current Balance: <b>${formatNumber(newBal)} ${escapeHtml(coin)}</b>`);
                        } catch {}
                    }
                    return;
                }

                if (act === 'cut_balance_user') {
                    if (!/^\d+$/.test(text)) {
                        await sendMessage(chatId, "❌ সঠিক User ID দিন:", getCancelKeyboard());
                        return;
                    }
                    const target = await getUser(text);
                    if (!target) {
                        await sendMessage(chatId, "❌ ইউজার পাওয়া যায়নি!", getCancelKeyboard());
                        return;
                    }
                    const coin = await getSetting('coin_name', 'STAR');
                    await setAdminState(fromId, 'cut_balance_amount', { target_id: text });
                    await sendMessage(chatId, `👤 <b>${escapeHtml(target.first_name || 'User')}</b>\n💰 ব্যালেন্স: <b>${formatNumber(target.balance || 0)} ${escapeHtml(coin)}</b>\n\nকত কাটতে চান?`, getCancelKeyboard());
                    return;
                }

                if (act === 'cut_balance_amount') {
                    if (!isNumericAmount(text) || Number(text) <= 0) {
                        await sendMessage(chatId, "❌ সঠিক Amount দিন:", getCancelKeyboard());
                        return;
                    }
                    const amt = Number(text);
                    const targetUser = await getUser(aState.target_id);
                    const coin = await getSetting('coin_name', 'STAR');
                    if (targetUser) {
                        const newBal = Math.max(0, Number(targetUser.balance || 0) - amt);
                        await updateUser(aState.target_id, { balance: newBal });
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>Deducted -${formatNumber(amt)} ${escapeHtml(coin)}</b>\n💰 New Balance: <b>${formatNumber(newBal)} ${escapeHtml(coin)}</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                        try {
                            await sendMessage(aState.target_id, `⚠️ <b>-${formatNumber(amt)} ${escapeHtml(coin)} deducted from your balance!</b>\n💰 Current Balance: <b>${formatNumber(newBal)} ${escapeHtml(coin)}</b>`);
                        } catch {}
                    }
                    return;
                }
            }
        }

        // ---------------------------------------------------------
        // USER STATE: WITHDRAWAL PROCESSING
        // ---------------------------------------------------------
        if (!isAdm) {
            const uState = await getUserState(fromId);
            if (uState && uState.action === 'withdraw_username' && text) {
                const target = normalizeWithdrawTarget(text);
                if (!isValidWithdrawTarget(target)) {
                    await sendMessage(chatId, "❌ Invalid address! Provide Channel Username (e.g. <code>@channel</code>) or Post Link (e.g. <code>https://t.me/channel/123</code>):", getCancelKeyboard());
                    return;
                }

                const u = await getUser(fromId);
                const fixedAmount = Number(await getSetting('min_withdraw', 2));
                const coinName = await getSetting('coin_name', 'STAR');
                const currentBalance = Number(u?.balance || 0);

                if (currentBalance < fixedAmount) {
                    await sendMessage(chatId, `⚠️ <b>Insufficient Balance!</b>\nMinimum Withdraw: <b>${formatNumber(fixedAmount)} ${escapeHtml(coinName)}</b>\nYour Balance: <b>${formatNumber(currentBalance)} ${escapeHtml(coinName)}</b>`, await getUserMenu(fromId));
                    await clearUserState(fromId);
                    return;
                }

                // First Withdraw Referral Requirement Check
                const isFirstWithdraw = !u?.has_withdrawn;
                const requiredRefs = Number(await getSetting('first_withdraw_refs', 3));
                const userRefs = Number(u?.total_referrals || 0);

                if (isFirstWithdraw && requiredRefs > 0 && userRefs < requiredRefs) {
                    await sendMessage(chatId, 
                        `⚠️ <b>Referral Requirement Not Met!</b>\n\n` +
                        `For your first withdrawal, you need at least <b>${requiredRefs} completed referrals</b>.\n\n` +
                        `👥 Your Referrals: <b>${userRefs}/${requiredRefs}</b>\n\n` +
                        `<i>Invite more users to unlock your first withdrawal!</i>`,
                        await getUserMenu(fromId)
                    );
                    await clearUserState(fromId);
                    return;
                }

                const fee = Number(await getSetting('withdraw_fee_percent', 0));
                const afterFee = Math.max(0, fixedAmount - (fixedAmount * fee / 100));
                const txId = `${fromId}${Math.floor(Date.now() / 1000)}`;

                const reqChannel = await getSetting('withdraw_request_channel', DEFAULT_PAYMENT_CHANNEL_ID);
                if (!reqChannel) {
                    await sendMessage(chatId, "⚠️ Withdraw Request Channel is not configured yet.", await getUserMenu(fromId));
                    await clearUserState(fromId);
                    return;
                }

                const withdrawData = {
                    user_id: fromId,
                    first_name: msg.from.first_name || 'User',
                    withdraw_username: target,
                    amount: fixedAmount,
                    fee_percent: fee,
                    after_fee: afterFee,
                    transaction_id: txId,
                    status: 'pending',
                    created_at: Math.floor(Date.now() / 1000)
                };

                // Instant Balance Cut
                await updateUser(fromId, { balance: Math.max(0, currentBalance - fixedAmount) });
                await clearUserState(fromId);

                const created = await firebaseRequest('withdrawals', 'POST', withdrawData);
                if (created && created.name) {
                    await sendMessage(reqChannel, buildPendingAlertText(withdrawData, coinName), withdrawActionKeyboard(created.name));

                    const withdrawConfirmText =
                        `🔔 <b>Withdrawal Submitted!</b>\n━━━━━━━━━━━━━━━━━━\n\n` +
                        `💰 Amount: <b>${formatNumber(fixedAmount)} ${escapeHtml(coinName)}</b>\n` +
                        `📊 Fee: <b>${formatNumber(fee)}%</b>\n` +
                        `💵 After Fee: <b>${formatNumber(afterFee)} ${escapeHtml(coinName)}</b>\n` +
                        `📬 To: <b>${escapeHtml(target)}</b>\n` +
                        `🧾 ID: <code>${txId}</code>\n` +
                        `📌 Status: <b>PENDING ⏳</b>`;

                    await sendMessage(chatId, withdrawConfirmText, await getUserMenu(fromId));
                } else {
                    await updateUser(fromId, { balance: currentBalance });
                    await sendMessage(chatId, "⚠️ Failed to submit withdraw request. Balance refunded.", await getUserMenu(fromId));
                }
                return;
            }
        }

        // ---------------------------------------------------------
        // USER COMMANDS & MENUS
        // ---------------------------------------------------------
        if (text.startsWith('/start')) {
            const politeStartText = `🌟 <b>Welcome, ${escapeHtml(msg.from.first_name || 'User')}!</b>\n\nEarn rewards easily and withdraw directly.`;
            await sendMessage(chatId, politeStartText, await getUserMenu(fromId));
            return;
        }

        if (text === '🛠 Admin Panel') {
            if (!isAdm) {
                await sendMessage(chatId, "⛔ <b>Access Denied!</b>", await getUserMenu(fromId));
                return;
            }
            await clearAdminState(fromId);
            await sendMessage(chatId, "🛠 <b>Admin Panel Activated</b>", await getAdminMenu(isSuperAdmin(fromId)));
            return;
        }

        if (text === '🔙 Back to User Panel') {
            await clearAdminState(fromId);
            await clearUserState(fromId);
            await sendMessage(chatId, "👤 <b>User Panel Activated</b>", await getUserMenu(fromId));
            return;
        }

        // 1. MY ACCOUNT (WITH EMBEDDED SUPPORT BUTTON ONLY)
        if (text === '👤 My Account') {
            const u = await getUser(fromId);
            const coinName = await getSetting('coin_name', 'STAR');
            const supportUrl = await getSetting('support_url', DEFAULT_SUPPORT_URL);

            const accText = 
                `👤 <b>MY ACCOUNT</b>\n━━━━━━━━━━━━━━━━━━\n\n` +
                `👤 Name: <b>${escapeHtml(msg.from.first_name || 'User')}</b>\n` +
                `🆔 ID: <code>${fromId}</code>\n` +
                `⭐ Balance: <b>${formatNumber(u?.balance || 0)} ${escapeHtml(coinName)}</b>\n` +
                `👥 Referrals: <b>${u?.total_referrals || 0}</b>`;

            const accKeyboard = {
                inline_keyboard: [
                    [{ text: '🎧 Support', url: supportUrl, style: 'primary' }]
                ]
            };

            await sendMessage(chatId, accText, accKeyboard);
            return;
        }

        // 2. REFERRAL
        if (text === '📮 Referral') {
            const u = await getUser(fromId);
            const refCount = Number(u?.total_referrals || 0);
            const refBonus = Number(await getSetting('referral_bonus', 1));
            const coinName = await getSetting('coin_name', 'STAR');
            const link = `https://t.me/${BOT_USERNAME}?start=${fromId}`;
            const shareText = encodeURIComponent(`🌟 Join and earn free ${coinName}!\n\nLink: ${link}`);
            const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${shareText}`;

            const refMessage =
                `📮 <b>Referral Program</b>\n━━━━━━━━━━━━━━━━━━\n\n` +
                `👥 Total Referrals: <b>${refCount}</b>\n` +
                `💰 Reward Per Referral: <b>${formatNumber(refBonus)} ${escapeHtml(coinName)}</b>\n\n` +
                `🔗 <b>Your Referral Link:</b>\n<code>${link}</code>`;

            await sendMessage(chatId, refMessage, {
                inline_keyboard: [
                    [{ text: '🚀 Share Link', url: shareUrl, style: 'success' }]
                ]
            });
            return;
        }

        // 3. WITHDRAW BUTTON
        if (text === '💸 Withdraw') {
            const u = await getUser(fromId);
            const bal = Number(u?.balance || 0);
            const fixedAmount = Number(await getSetting('min_withdraw', 2));
            const coinName = await getSetting('coin_name', 'STAR');

            if (bal < fixedAmount) {
                await sendMessage(chatId, `⚠️ <b>Insufficient Balance!</b>\n\nMinimum Withdraw: <b>${formatNumber(fixedAmount)} ${escapeHtml(coinName)}</b>\nYour Balance: <b>${formatNumber(bal)} ${escapeHtml(coinName)}</b>`);
                return;
            }

            // Early check for 1st withdraw requirement
            const isFirstWithdraw = !u?.has_withdrawn;
            const requiredRefs = Number(await getSetting('first_withdraw_refs', 3));
            const userRefs = Number(u?.total_referrals || 0);

            if (isFirstWithdraw && requiredRefs > 0 && userRefs < requiredRefs) {
                await sendMessage(chatId, 
                    `⚠️ <b>Referral Requirement Not Met!</b>\n\n` +
                    `For your first withdrawal, you must complete at least <b>${requiredRefs} referrals</b>.\n\n` +
                    `👥 Your Referrals: <b>${userRefs}/${requiredRefs}</b>\n\n` +
                    `<i>Please invite more friends to proceed.</i>`
                );
                return;
            }

            await setUserState(fromId, 'withdraw_username');
            const withdrawPrompt = 
                `💸 <b>WITHDRAW ${escapeHtml(coinName)}</b>\n━━━━━━━━━━━━━━━━━━\n\n` +
                `💰 Fixed Amount: <b>${formatNumber(fixedAmount)} ${escapeHtml(coinName)}</b>\n\n` +
                `📢 Send your Channel Username or Post Link:\n` +
                `Example: <code>@channelname</code> or <code>https://t.me/channel/123</code>`;

            await sendMessage(chatId, withdrawPrompt, getCancelKeyboard());
            return;
        }

        // 4. HISTORY
        if (text === '📜 History') {
            const history = await getUserWithdrawals(fromId);
            const coinName = await getSetting('coin_name', 'STAR');
            if (!history.length) {
                await sendMessage(chatId, "📜 No withdrawal history found.");
                return;
            }
            let out = "📜 <b>YOUR WITHDRAWAL HISTORY</b>\n━━━━━━━━━━━━━━━━━━\n";
            for (const h of history) {
                out += `\n• <b>${h.status.toUpperCase()}</b>: ${formatNumber(h.amount)} ${escapeHtml(coinName)} (${h.withdraw_username})`;
            }
            await sendMessage(chatId, out);
            return;
        }

        // 5. SYSTEM STATUS
        if (text === '📊 System Status') {
            const users = await getAllUsers();
            const totalUsersCount = Object.keys(users).length;
            const customPayouts = await getSetting('custom_payouts_done', '0');
            const coinName = await getSetting('coin_name', 'STAR');

            const sourceName = (await getSetting('source_name', DEVELOPER_NAME)) || DEVELOPER_NAME;
            const sourceLink = (await getSetting('source_link', DEVELOPER_LINK)) || DEVELOPER_LINK;

            let sourceDisplay = escapeHtml(sourceName);
            if (sourceLink) {
                sourceDisplay = `<a href="${escapeHtml(sourceLink)}">${escapeHtml(sourceName)}</a>`;
            }

            const statusMessage =
                `📡 <b>SYSTEM STATUS</b>\n━━━━━━━━━━━━━━━━━━\n\n` +
                `👥 <b>Total Users:</b> ${totalUsersCount} Users\n\n` +
                `⭐ <b>Payouts Done:</b> ${escapeHtml(customPayouts)} ${escapeHtml(coinName)}\n\n` +
                `🔧 <b>Source:</b> ${sourceDisplay}`;

            await sendMessage(chatId, statusMessage);
            return;
        }

        // ---------------------------------------------------------
        // ADMIN PANEL BUTTONS
        // ---------------------------------------------------------
        if (isAdm) {
            // TOGGLE BOT POWER (ON / OFF)
            if (text.startsWith('🟢 Bot: Active (ON)') || text.startsWith('🔴 Bot: OFF (Maintenance)')) {
                const currentStatus = await isBotActive();
                const newStatus = currentStatus ? 'off' : 'on';
                await setSetting('bot_power_status', newStatus);
                cache.botActive = newStatus === 'on';
                cache.botActiveExpiresAt = Date.now() + 30000;
                await sendMessage(chatId, `🔄 <b>Bot Status Updated:</b> <b>${newStatus === 'on' ? '🟢 ONLINE' : '🔴 OFFLINE (Maintenance)'}</b>`, await getAdminMenu(isSuperAdmin(fromId)));
                return;
            }

            if (text === '⚙️ Central Settings') {
                await sendMessage(chatId, "⚙️ <b>Central Configuration</b>\nনিচে থেকে যেকোনো সেটিং সিলেক্ট করে এডিট করুন:", centralSettingsKeyboard());
                return;
            }

            if (text.startsWith('🛡️ Security')) {
                await sendMessage(chatId, "🛡️ <b>Security Management</b>\nমোবাইল সিকিউরিটির মতো ব্লকলিস্ট ও হোয়াইটলিস্ট কন্ট্রোল:", await securityKeyboard());
                return;
            }

            if (text === '👥 User & Balance') {
                await sendMessage(chatId, "👥 <b>User & Balance Management</b>", balanceKeyboard());
                return;
            }

            if (text === '📢 Force Channels') {
                const forceChannels = await getAllForceChannels();
                const textOut = `📢 <b>FORCE JOIN CHANNELS</b>\n\nমোট চ্যানেল: <b>${Object.keys(forceChannels).length}</b> টি`;
                await sendMessage(chatId, textOut, forceJoinKeyboard());
                return;
            }

            // SMART CHANNEL BROADCAST WITH PARALLEL ADMIN CHECK
            if (text === '📢 Channel Broadcast') {
                const channels = await getAllForceChannels();
                const entries = Object.entries(channels);

                if (!entries.length) {
                    await sendMessage(chatId, "⚠️ কোনো চ্যানেল অ্যাড করা নেই!");
                    return;
                }

                // Check permissions parallelly (sub-300ms)
                const checkStatusPromises = entries.map(async ([key, ch]) => {
                    const isAdminThere = await isBotAdminInChat(ch.channel_id);
                    return { key, ch, isAdminThere };
                });

                const checkedResults = await Promise.all(checkStatusPromises);
                const inlineKb = [];
                let report = "📢 <b>চ্যানেল ব্রডকাস্ট প্যানেল</b>\n━━━━━━━━━━━━━━━━━━\n\n";

                for (const item of checkedResults) {
                    const statusText = item.isAdminThere ? "✅ Bot Admin" : "⚠️ Bot Not Admin";
                    report += `• <b>${escapeHtml(item.ch.channel_name || 'Channel')}</b>: ${statusText}\n`;

                    inlineKb.push([
                        { 
                            text: `${item.isAdminThere ? '📢' : '⚠️'} ${item.ch.channel_name || 'Channel'} (${statusText})`, 
                            callback_data: `bc_select_channel_${item.key}`, 
                            style: item.isAdminThere ? 'primary' : 'danger' 
                        }
                    ]);
                }

                inlineKb.push([
                    { text: '📢 Broadcast to ALL Channels', callback_data: 'bc_all_channels', style: 'success' }
                ]);

                report += `\n<i>নির্দিষ্ট চ্যানেলে ব্রডকাস্ট পাঠাতে বাটনে ক্লিক করুন:</i>`;
                await sendMessage(chatId, report, { inline_keyboard: inlineKb });
                return;
            }

            if (text === '📢 Users Broadcast') {
                await setAdminState(fromId, 'awaiting_broadcast_message');
                await sendMessage(chatId, "📢 <b>ইউজার ব্রডকাস্ট</b>\n\nসকল ইউজারের কাছে পাঠানোর জন্য মেসেজটি পাঠান (Text, Photo, Video, File, Forward):", getCancelKeyboard());
                return;
            }

            if (text === '⭐ সেট Payouts Done') {
                await setAdminState(fromId, 'set_payouts_done');
                const cur = await getSetting('custom_payouts_done', '0');
                await sendMessage(chatId, `⭐ <b>Payouts Done</b>\n\nবর্তমান মান: <b>${escapeHtml(cur)}</b>\nনতুন সংখ্যা পাঠান:`, getCancelKeyboard());
                return;
            }

            if (text === '🔧 Source Settings') {
                await setAdminState(fromId, 'set_source_info');
                const curName = await getSetting('source_name', DEVELOPER_NAME);
                const curLink = await getSetting('source_link', DEVELOPER_LINK);
                await sendMessage(chatId, `🔧 <b>Source Settings</b>\n\nবর্তমান Source: <b>${escapeHtml(curName)}</b>\nবর্তমান Link: <code>${escapeHtml(curLink)}</code>\n\nনতুন নাম এবং লিংক দিন: <code>NAME | LINK</code>`, getCancelKeyboard());
                return;
            }

            if (text === '👮 এডমিন ম্যানেজমেন্ট' && isSuperAdmin(fromId)) {
                await sendMessage(chatId, "👮 <b>এডমিন ম্যানেজমেন্ট</b>", adminManagementKeyboard());
                return;
            }
        }
    }
}

/*
|--------------------------------------------------------------------------
| 24/7 EXPRESS SERVER & WEBHOOK
|--------------------------------------------------------------------------
*/
const app = express();
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

app.post('/api/index', async (req, res) => {
    try {
        await handleUpdate(req.body || {});
    } catch (err) {
        console.error('Update Error:', err);
    }
    return res.status(200).send('OK');
});

app.get('/api/index', (req, res) => {
    res.status(200).send('Bot Webhook Endpoint Active ⚡');
});

app.get('/', (req, res) => {
    res.status(200).send('Aura Star Pay Bot is Online 24/7 🚀');
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT}`);
    try {
        const webhookUrl = `${APP_URL}/api/index`;
        const res = await telegramApi('setWebhook', { url: webhookUrl, drop_pending_updates: true });
        console.log('Webhook Setup Status:', res);
    } catch (err) {
        console.error('Webhook Setup Error:', err);
    }
});
