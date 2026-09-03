/*
|--------------------------------------------------------------------------
| AURA STAR PAY BOT (100% PRODUCTION READY & STRICT ADMIN SECURITY 🔒)
| - Super Admin: 8045367594
| - 24/7 Express Server for Render.com
| - Auto-Webhook Setup on Server Startup (No Browser Link Needed)
| - Mobile MB (GP, Robi, BL, Teletalk) & Wi-Fi 100% Compatible
| - Relative API Path & CORS Preflight Fixed
| - Auto Delete Verification Prompt on Success/Reject
| - Live Telegram Profile Photo in Mini App
|--------------------------------------------------------------------------
*/

const express = require('express');
const crypto = require('crypto');

const BOT_TOKEN = '8809628706:AAFz_QHyiKpdwyT_jh66HBiRvG0vo9NH3QE';
const BOT_USERNAME = 'AuraStarPayBot';
const APP_URL = 'https://star-pay-go71.onrender.com';
const SUPPORT_USERNAME = 'Sakib_Developer1'; // Support username without @

// শুধুমাত্র আপনার নির্দিষ্ট সুপার অ্যাডমিন আইডি
const SUPER_ADMIN_ID = 8045367594;

/*
|--------------------------------------------------------------------------
| FIREBASE CONFIGURATION (AURA-STAR-PAY)
|--------------------------------------------------------------------------
*/
const FIREBASE_URL = 'https://aura-star-pay-default-rtdb.firebaseio.com';
const FIREBASE_API_KEY = 'AIzaSyDq337oNcs6G7m3ahBnOhnHzgBhzr892GU';
const FIREBASE_AUTH_EMAIL = 'sakib301210@gmail.com';
const FIREBASE_AUTH_PASSWORD = '@mayabiri';
const FIREBASE_AUTH_UID = 'WUVFzcS2jvXDXgGfUAQPl9ESl943';

/*
|--------------------------------------------------------------------------
| BASIC HELPERS & CRYPTOGRAPHY
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
    if (!isFinite(num)) return 'Unlimited';
    if (Math.abs(num - Math.round(num)) < 0.0000001) {
        return Math.round(num).toString();
    }
    return parseFloat(num.toFixed(8)).toString();
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

function formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(timestamp) {
    return new Date(timestamp * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function sha256(data) {
    return crypto.createHash('sha256').update(String(data)).digest('hex');
}

function generateVerificationSignature(userId, timestamp) {
    return crypto.createHmac('sha256', BOT_TOKEN).update(`${userId}_${timestamp}`).digest('hex');
}

function verifySignature(userId, timestamp, signature) {
    try {
        const expected = generateVerificationSignature(userId, timestamp);
        return crypto.timingSafeEqual(Buffer.from(signature || '', 'hex'), Buffer.from(expected, 'hex'));
    } catch {
        return false;
    }
}

/*
|--------------------------------------------------------------------------
| FIREBASE REST API CLIENT
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
        if (!res.ok && token && (res.status === 401 || res.status === 403)) {
            const fallbackUrl = `${FIREBASE_URL.replace(/\/+$/, '')}/${path}.json`;
            res = await fetch(fallbackUrl, options);
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
| DATABASE HELPERS
|--------------------------------------------------------------------------
*/
async function getUser(userId) {
    const res = await firebaseRequest(`users/${userId}`);
    return res && typeof res === 'object' ? res : null;
}

async function setUser(userId, data) {
    return (await firebaseRequest(`users/${userId}`, 'PUT', data)) !== null;
}

async function updateUser(userId, data) {
    return (await firebaseRequest(`users/${userId}`, 'PATCH', data)) !== null;
}

async function getSetting(key, defaultValue = null) {
    const val = await firebaseRequest(`settings/${key}`);
    return val === null ? defaultValue : val;
}

async function setSetting(key, value) {
    return (await firebaseRequest(`settings/${key}`, 'PUT', value)) !== null;
}

async function deleteSetting(key) {
    return (await firebaseRequest(`settings/${key}`, 'DELETE')) !== null;
}

async function getAllUsers() {
    const res = await firebaseRequest('users');
    return res && typeof res === 'object' ? res : {};
}

async function getAllAdmins() {
    const res = await firebaseRequest('admins');
    return res && typeof res === 'object' ? res : {};
}

async function getAllForceChannels() {
    const res = await firebaseRequest('force_channels');
    return res && typeof res === 'object' ? res : {};
}

async function getPaymentVerificationChannel() {
    let raw = await getSetting('payment_verification_channel', '');
    if (Array.isArray(raw)) raw = raw[0];
    let channel = String(raw || '').trim();
    if (channel !== '') {
        await setSetting('payment_verification_channel', channel);
        await deleteSetting('withdraw_required_channel');
        return channel;
    }
    return '';
}

async function getWithdrawRequestChannel() {
    let raw = await getSetting('withdraw_request_channel', '');
    if (Array.isArray(raw)) raw = raw[0];
    return String(raw || '').trim();
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
        if (!res.ok) return { ok: false };
        return await res.json();
    } catch {
        return { ok: false };
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

async function sendReplyMessage(chatId, replyToMessageId, text, replyMarkup = null) {
    const params = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_parameters: { message_id: replyToMessageId, allow_sending_without_reply: true }
    };
    if (replyMarkup) params.reply_markup = replyMarkup;
    return await telegramApi('sendMessage', params);
}

async function deleteMessage(chatId, messageId) {
    return await telegramApi('deleteMessage', { chat_id: chatId, message_id: messageId });
}

async function answerCallback(callbackId, text = '', alert = false) {
    await telegramApi('answerCallbackQuery', {
        callback_query_id: callbackId,
        text: text,
        show_alert: alert
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
| ADMIN & STATE MANAGEMENT
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

function isSuperAdmin(userId) {
    return String(userId).trim() === String(SUPER_ADMIN_ID);
}

async function isAdmin(userId) {
    const uidStr = String(userId).trim();
    if (isSuperAdmin(uidStr)) return true;
    const admin = await firebaseRequest(`admins/${uidStr}`);
    return Boolean(admin && typeof admin === 'object' && admin.active === true);
}

/*
|--------------------------------------------------------------------------
| KEYBOARDS
|--------------------------------------------------------------------------
*/
async function getUserMenu(userId) {
    const isAdm = await isAdmin(userId);
    const keyboard = [
        [{ text: '👤 My Account' }, { text: '👥 Refer & Earn' }],
        [{ text: '💸 Withdraw' }, { text: '📜 History' }],
        [{ text: '🎁 Gift Code' }]
    ];
    if (isAdm) keyboard.push([{ text: '🛠 Admin Panel' }]);
    return { keyboard: keyboard, resize_keyboard: true, is_persistent: true };
}

function getAdminMenu(superAdmin) {
    const keyboard = [
        [{ text: '📊 পরিসংখ্যান' }, { text: '👥 User & Balance Management' }],
        [{ text: '💸 Withdraw Settings' }, { text: '📢 Channel Settings' }],
        [{ text: '🎁 বোনাস সেটিংস' }, { text: '🎁 Gift Code' }],
        [{ text: '📢 ব্রডকাস্ট' }, { text: '🛡️ রিস্টার্ট অল ভেরিফিকেশন' }]
    ];
    if (superAdmin) keyboard.push([{ text: '👮 এডমিন ম্যানেজমেন্ট' }]);
    keyboard.push([{ text: '🔙 ইউজার প্যানেলে ফিরে যান' }]);
    return { keyboard: keyboard, resize_keyboard: true, is_persistent: true };
}

function getCancelKeyboard() {
    return { keyboard: [[{ text: '/cancel' }]], resize_keyboard: true, one_time_keyboard: true };
}

function adminManagementKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '➕ এডমিন যোগ করুন', callback_data: 'admin_add' },
                { text: '➖ এডমিন রিমুভ করুন', callback_data: 'admin_remove' }
            ],
            [{ text: '👮 এডমিন তালিকা', callback_data: 'admin_list' }]
        ]
    };
}

function forceJoinKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '➕ চ্যানেল যোগ করুন', callback_data: 'force_add' },
                { text: '➖ চ্যানেল রিমুভ করুন', callback_data: 'force_remove' }
            ],
            [{ text: '📋 চ্যানেল তালিকা', callback_data: 'force_list' }]
        ]
    };
}

function balanceKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '➕ ব্যালেন্স যোগ করুন', callback_data: 'balance_add' },
                { text: '➖ ব্যালেন্স কাটুন', callback_data: 'balance_cut' }
            ]
        ]
    };
}

function bonusKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '🎁 ওয়েলকাম বোনাস', callback_data: 'bonus_welcome' }],
            [{ text: '👥 রেফারেল বোনাস', callback_data: 'bonus_referral' }]
        ]
    };
}

function withdrawSettingsKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '💰 ফিক্সড উইথড্র অ্যামাউন্ট সেট করুন', callback_data: 'withdraw_minimum' }],
            [{ text: '📊 উইথড্র ফি (%)', callback_data: 'withdraw_fee' }]
        ]
    };
}

function giftKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '➕ নতুন Gift Code', callback_data: 'gift_create' },
                { text: '📋 Gift Code তালিকা', callback_data: 'gift_list' }
            ]
        ]
    };
}

function withdrawActionKeyboard(withdrawId) {
    const claimUrl = `https://t.me/${BOT_USERNAME}?start=claim`;
    return {
        inline_keyboard: [
            [
                { text: '✅ Approve', callback_data: `withdraw_approve_${withdrawId}` },
                { text: '❌ Reject', callback_data: `withdraw_reject_${withdrawId}` }
            ],
            [
                { text: '🎁 Claim 2 Star', url: claimUrl }
            ]
        ]
    };
}

function claimOnlyKeyboard() {
    const claimUrl = `https://t.me/${BOT_USERNAME}?start=claim`;
    return {
        inline_keyboard: [
            [{ text: '🎁 Claim 2 Star', url: claimUrl }]
        ]
    };
}

function normalizeTelegramUsernameInput(input) {
    input = normalizeText(input);
    input = input.replace(/^https?:\/\/t\.me\//i, '@').replace(/^t\.me\//i, '@').trim();
    if (input !== '' && !input.startsWith('@')) input = '@' + input;
    return input;
}

function isValidTelegramUsername(username) {
    return /^@[A-Za-z0-9_]{5,32}$/.test(username);
}

function isValidChannelTarget(channel) {
    channel = channel.trim();
    return /^@[A-Za-z0-9_]{5,32}$/.test(channel) || /^-100[0-9]{5,20}$/.test(channel);
}

async function getTelegramChat(chatId) {
    const res = await telegramApi('getChat', { chat_id: chatId });
    return res && res.ok ? res.result : null;
}

async function getTelegramUsername(userId) {
    const chat = await getTelegramChat(userId);
    return chat && chat.username ? '@' + chat.username : `@admin_${userId}`;
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

async function isUserJoinedAllChannels(userId) {
    const forceChannels = await getAllForceChannels();
    for (const ch of Object.values(forceChannels)) {
        if (ch && ch.channel_id && !(await isJoinedChannel(ch.channel_id, userId))) return false;
    }
    const paymentChannel = await getPaymentVerificationChannel();
    if (paymentChannel && !(await isJoinedChannel(paymentChannel, userId))) return false;
    return true;
}

/*
|--------------------------------------------------------------------------
| FORCE JOIN & VERIFICATION PROMPTS
|--------------------------------------------------------------------------
*/
async function showForceJoin(chatId) {
    const forceChannels = await getAllForceChannels();
    const keyboard = [];

    for (const ch of Object.values(forceChannels)) {
        if (ch && ch.channel_link) {
            keyboard.push([{ text: `📢 ${ch.channel_name || 'Join Channel'}`, url: ch.channel_link }]);
        }
    }

    const paymentChannel = await getPaymentVerificationChannel();
    if (paymentChannel) {
        const link = paymentChannel.startsWith('@') ? `https://t.me/${paymentChannel.slice(1)}` : '';
        if (link) keyboard.push([{ text: '📢 Payment/Verification Channel', url: link }]);
    }

    keyboard.push([{ text: '✅ Verify', callback_data: 'verify_join' }]);
    const text = "📢 <b>Please join our channel first to continue.</b>\n\nAfter joining, press the Verify button below.";
    await sendMessage(chatId, text, { inline_keyboard: keyboard });
}

async function sendDeviceVerificationPrompt(chatId, userId, firstName) {
    const oldPrompt = await firebaseRequest(`verify_prompts/${userId}`);
    if (oldPrompt && oldPrompt.chat_id && oldPrompt.message_id) {
        try { await deleteMessage(oldPrompt.chat_id, oldPrompt.message_id); } catch {}
    }

    const now = Math.floor(Date.now() / 1000);
    const signature = generateVerificationSignature(userId, now);
    const verifyUrl = `${APP_URL}/api/index?action=verify_flow&uid=${userId}&name=${encodeURIComponent(firstName || 'User')}&t=${now}&sig=${signature}`;

    const text = 
        "🔐 <b>Device Security Scan</b>\n━━━━━━━━━━━━━━━━━━\n\n" +
        "Please complete quick device verification to unlock all bot features:";

    const keyboard = {
        inline_keyboard: [
            [{ text: '🔐 Verify Account & Device', web_app: { url: verifyUrl } }]
        ]
    };

    const sent = await sendMessage(chatId, text, keyboard);
    if (sent && sent.ok && sent.result?.message_id) {
        await firebaseRequest(`verify_prompts/${userId}`, 'PUT', {
            chat_id: chatId,
            message_id: sent.result.message_id,
            created_at: now
        });
    }
}

async function deleteVerificationPrompt(userId) {
    try {
        const prompt = await firebaseRequest(`verify_prompts/${userId}`);
        if (prompt && prompt.chat_id && prompt.message_id) {
            await deleteMessage(prompt.chat_id, prompt.message_id);
            await firebaseRequest(`verify_prompts/${userId}`, 'DELETE');
        }
    } catch {}
}

/*
|--------------------------------------------------------------------------
| COMPACT WITHDRAW ALERTS
|--------------------------------------------------------------------------
*/
function buildPendingAlertText(withdraw) {
    const amount = Number(withdraw.amount || 0);
    const fee = Number(withdraw.fee_percent || 0);
    const afterFee = Number(withdraw.after_fee || amount);
    const userId = String(withdraw.user_id || '');
    const withdrawUsername = String(withdraw.withdraw_username || 'N/A');
    const transactionId = String(withdraw.transaction_id || '');

    return "🔔 <b>New Stars Request Pending Alert!</b>\n\n" +
        `📌 <b>User :</b> <code>${escapeHtml(userId)}</code>\n\n` +
        `💳 <b>Stars :</b> <b>${formatNumber(amount)}🌟</b> (Fee: ${formatNumber(fee)}%: \n` +
        `   After Fee <b>${formatNumber(afterFee)}🌟</b>)\n\n` +
        `📬 <b>Send To (Address):</b> <b>${escapeHtml(withdrawUsername)}</b>\n\n` +
        `🧾 <b>Transaction ID:</b> <code>${escapeHtml(transactionId)}</code>`;
}

function buildApprovedAlertText(withdraw, adminUsername) {
    const amount = Number(withdraw.amount || 0);
    const fee = Number(withdraw.fee_percent || 0);
    const afterFee = Number(withdraw.after_fee || amount);
    const userId = String(withdraw.user_id || '');
    const withdrawUsername = String(withdraw.withdraw_username || 'N/A');
    const transactionId = String(withdraw.transaction_id || '');

    return "✅ <b>Stars Request Approved!</b>\n\n" +
        `📌 <b>User :</b> <code>${escapeHtml(userId)}</code>\n\n` +
        `💳 <b>Stars :</b> <b>${formatNumber(amount)}🌟</b> (Fee: ${formatNumber(fee)}%: \n` +
        `   After Fee <b>${formatNumber(afterFee)}🌟</b>)\n\n` +
        `📬 <b>Send To (Address):</b> <b>${escapeHtml(withdrawUsername)}</b>\n\n` +
        `🧾 <b>Transaction ID:</b> <code>${escapeHtml(transactionId)}</code>\n` +
        `👮 <b>Approved By:</b> <b>${escapeHtml(adminUsername)}</b>`;
}

function buildRejectedAlertText(withdraw, adminUsername) {
    const amount = Number(withdraw.amount || 0);
    const userId = String(withdraw.user_id || '');
    const transactionId = String(withdraw.transaction_id || '');

    return "❌ <b>Stars Request Rejected!</b>\n\n" +
        `📌 <b>User :</b> <code>${escapeHtml(userId)}</code>\n\n` +
        `💳 <b>Stars :</b> <b>${formatNumber(amount)}🌟</b> (Refunded)\n\n` +
        `🧾 <b>Transaction ID:</b> <code>${escapeHtml(transactionId)}</code>\n` +
        `👮 <b>Rejected By:</b> <b>${escapeHtml(adminUsername)}</b>`;
}

/*
|--------------------------------------------------------------------------
| ANTI-MULTI-ACCOUNT SCAN SUBMISSION
|--------------------------------------------------------------------------
*/
async function handleDeviceVerificationSubmit(req, res) {
    try {
        const body = req.body || {};
        const { uid, t, sig, device_token, hardware_id } = body;

        if (!uid || !t || !sig || !hardware_id) {
            return res.status(400).json({ success: false, message: 'Invalid payload' });
        }

        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - Number(t)) > 3600) {
            return res.status(403).json({ success: false, message: 'Session expired' });
        }
        if (!verifySignature(uid, t, sig)) {
            return res.status(403).json({ success: false, message: 'Invalid signature' });
        }

        let user = await getUser(uid);
        if (!user) {
            user = {
                telegram_id: String(uid),
                first_name: 'User',
                balance: 0,
                verification_status: 'pending_channel',
                is_verified: false,
                created_at: now
            };
            await setUser(uid, user);
        }

        if (user.verification_status === 'verified') {
            await deleteVerificationPrompt(uid);
            return res.status(200).json({ success: true, already_verified: true });
        }

        if (user.verification_status === 'multiple_account_blocked' || user.verification_status === 'manually_blocked') {
            await deleteVerificationPrompt(uid);
            return res.status(403).json({ success: false, reason: 'MULTIPLE_ACCOUNT_BLOCKED' });
        }

        const joinedAll = await isUserJoinedAllChannels(uid);
        if (!joinedAll) {
            return res.status(400).json({ success: false, reason: 'CHANNEL_NOT_JOINED', message: 'Please join all required channels first.' });
        }

        const isUserAdmin = isSuperAdmin(uid) || (await isAdmin(uid));
        const rawIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
        const clientIp = rawIp.split(',')[0].trim();
        const ipHash = sha256(clientIp);
        const deviceTokenHash = sha256(device_token || hardware_id);

        if (!isUserAdmin) {
            const registeredHardware = await firebaseRequest(`registered_hardware/${hardware_id}`);
            const registeredToken = await firebaseRequest(`registered_tokens/${deviceTokenHash}`);

            let isMultipleAccount = false;
            let originalVerifiedUser = null;

            if (registeredHardware && String(registeredHardware.user_id) !== String(uid) && !registeredHardware.is_admin) {
                isMultipleAccount = true;
                originalVerifiedUser = registeredHardware.user_id;
            } else if (registeredToken && String(registeredToken.user_id) !== String(uid) && !registeredToken.is_admin) {
                isMultipleAccount = true;
                originalVerifiedUser = registeredToken.user_id;
            }

            if (isMultipleAccount) {
                await updateUser(uid, {
                    verification_status: 'multiple_account_blocked',
                    blocked_reason: `Same hardware detected as verified user ${originalVerifiedUser}`,
                    is_verified: false,
                    updated_at: now
                });

                await deleteVerificationPrompt(uid);

                const blockMsg = 
                    "🚫 <b>Multiple Account Detected</b>\n\n" +
                    "Multiple accounts are not allowed on the same device.\n\n" +
                    "Your account could not be verified because another Telegram account is already verified on this device.\n\n" +
                    "If you believe this is a mistake, please contact support.";
                await sendMessage(uid, blockMsg, {
                    inline_keyboard: [[{ text: '👨‍💻 Contact Support', url: `https://t.me/${SUPPORT_USERNAME}` }]]
                });

                return res.status(403).json({ success: false, reason: 'MULTIPLE_ACCOUNT_BLOCKED' });
            }

            await firebaseRequest(`registered_hardware/${hardware_id}`, 'PUT', { user_id: String(uid), is_admin: false, created_at: now });
            await firebaseRequest(`registered_tokens/${deviceTokenHash}`, 'PUT', { user_id: String(uid), is_admin: false, created_at: now });
        }

        await firebaseRequest(`user_verifications/${uid}`, 'PUT', {
            telegram_id: String(uid),
            username: String(user.username || ''),
            ip_hash: ipHash,
            hardware_id: hardware_id,
            device_token_hash: deviceTokenHash,
            verification_status: 'verified',
            first_verified_at: now,
            last_verified_at: now,
            created_at: now,
            updated_at: now
        });

        const welcomeBonus = Number(await getSetting('welcome_bonus', 0));
        let newBalance = Number(user.balance || 0);

        const userUpdates = {
            verification_status: 'verified',
            is_verified: true,
            verified_at: now
        };

        if (!user.welcome_claimed) {
            newBalance += welcomeBonus;
            userUpdates.balance = newBalance;
            userUpdates.welcome_claimed = true;
        }

        await updateUser(uid, userUpdates);

        if (user.referred_by && !user.referral_rewarded) {
            const ref = await getUser(user.referred_by);
            if (ref && ref.verification_status === 'verified') {
                const refBonus = Number(await getSetting('referral_bonus', 0));
                await updateUser(user.referred_by, {
                    balance: Number(ref.balance || 0) + refBonus,
                    total_referrals: Number(ref.total_referrals || 0) + 1
                });
                await updateUser(uid, { referral_rewarded: true });
                await sendMessage(user.referred_by, `🎉 <b>New Referral Verified!</b>\n━━━━━━━━━━━━━━━━━━\n\nYour referred user has completed verification!\n\n⭐ Bonus: <b>+${formatNumber(refBonus)} STAR</b>\n👥 Total Referrals: <b>${Number(ref.total_referrals || 0) + 1}</b>`);
            }
        }

        await deleteVerificationPrompt(uid);

        const successMsg = "✅ <b>Verification Successful</b>\n\nYour Telegram account and device have been successfully verified.\n\nWelcome! 🎉";
        await sendMessage(uid, successMsg);

        const mainMenuPrompt = `🏠 <b>Main Menu</b>\n━━━━━━━━━━━━━━━━━━\n🌟 <i>যেকোনো সুবিধা পেতে নিচের মেনু অপশনগুলো ব্যবহার করুন।</i>`;
        await sendMessage(uid, mainMenuPrompt, await getUserMenu(uid));

        return res.status(200).json({ success: true, message: 'VERIFIED' });
    } catch {
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

/*
|--------------------------------------------------------------------------
| MINI APP HTML (100% RESPONSIVE FOR MOBILE MB & WIFI)
|--------------------------------------------------------------------------
*/
function renderMiniAppPage(uid, name, t, sig) {
    const displayName = escapeHtml(decodeURIComponent(name || 'User'));
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>START BOT INC</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; -webkit-tap-highlight-color: transparent; }
        body { background: #070d18; color: #ffffff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; overflow: hidden; }
        .main-card { background: linear-gradient(180deg, #111b2e 0%, #0b1220 100%); border: 1px solid rgba(56, 189, 248, 0.15); border-radius: 28px; width: 100%; max-width: 380px; padding: 24px 20px 30px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); }
        .user-header { width: 100%; display: flex; align-items: center; justify-content: space-between; padding-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.07); margin-bottom: 25px; }
        .user-info { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #38bdf8, #2563eb); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; color: #fff; overflow: hidden; }
        .avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .user-details h3 { font-size: 16px; font-weight: 600; color: #f8fafc; }
        .user-details p { font-size: 12px; color: #64748b; margin-top: 2px; }
        .theme-btn { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; padding: 6px 14px; border-radius: 20px; font-size: 12px; }
        .status-badge { padding: 5px 16px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 30px; }
        .status-badge.scanning { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
        .status-badge.processing { background: rgba(6, 182, 212, 0.15); color: #22d3ee; border: 1px solid rgba(6, 182, 212, 0.3); }
        .status-badge.verified { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
        .status-badge.blocked { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
        .circle-icon-wrapper { width: 120px; height: 120px; border-radius: 50%; background: radial-gradient(circle, rgba(30, 58, 102, 0.5) 0%, rgba(15, 23, 42, 0.8) 100%); border: 2px solid rgba(56, 189, 248, 0.2); display: flex; align-items: center; justify-content: center; margin-bottom: 30px; position: relative; }
        .circle-icon-wrapper.pulse::after { content: ''; position: absolute; width: 100%; height: 100%; border-radius: 50%; border: 2px solid #38bdf8; animation: ripple 1.6s ease-out infinite; }
        @keyframes ripple { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.4); opacity: 0; } }
        .icon-svg { width: 52px; height: 52px; fill: none; }
        .title { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
        .subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 35px; text-align: center; }
        .action-btn { width: 100%; padding: 16px; border-radius: 16px; font-size: 15px; font-weight: 600; border: none; cursor: default; text-align: center; text-decoration: none; }
        .btn-disabled { background: #131d2e; color: #475569; }
        .btn-active { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; cursor: pointer; }
        .btn-danger { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; cursor: pointer; }
    </style>
</head>
<body>
    <div class="main-card">
        <div class="user-header">
            <div class="user-info">
                <div class="avatar" id="userAvatar">${displayName.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <h3>${displayName}</h3>
                    <p>ID: ${uid}</p>
                </div>
            </div>
            <div class="theme-btn">✨ Theme</div>
        </div>

        <div id="badgeEl" class="status-badge scanning"><span style="font-size: 8px;">●</span> SCANNING</div>

        <div id="iconWrapper" class="circle-icon-wrapper pulse">
            <svg id="iconEl" class="icon-svg" viewBox="0 0 24 24" stroke="#60a5fa" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01"/>
            </svg>
        </div>

        <h2 id="titleEl" class="title">Security Scan</h2>
        <p id="subEl" class="subtitle">Analyzing network packets...</p>
        <button id="actionBtn" class="action-btn btn-disabled">Awaiting Verification</button>
    </div>

    <script>
        (function() {
            var script = document.createElement('script');
            script.src = "https://telegram.org/js/telegram-web-app.js";
            script.async = true;
            document.head.appendChild(script);
        })();

        function loadUserProfilePhoto() {
            try {
                var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
                var photoUrl = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user.photo_url : null;
                var av = document.getElementById('userAvatar');
                if (photoUrl) {
                    av.innerHTML = '<img src="' + photoUrl + '" alt="Avatar" onerror="this.remove();">';
                } else {
                    var proxyImg = new Image();
                    proxyImg.onload = function() { av.innerHTML = '<img src="/api/index?action=avatar&uid=${uid}" alt="Avatar" onerror="this.remove();">'; };
                    proxyImg.src = "/api/index?action=avatar&uid=${uid}";
                }
            } catch(e) {}
        }

        async function sha256Browser(str) {
            try {
                var buffer = new TextEncoder().encode(str);
                var hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
                return Array.from(new Uint8Array(hashBuffer)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
            } catch(e) {
                return 'h_' + btoa(str).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
            }
        }

        async function startVerification() {
            loadUserProfilePhoto();
            var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
            if (tg) { try { tg.ready(); tg.expand(); } catch(e) {} }

            var badgeEl = document.getElementById('badgeEl');
            var iconWrapper = document.getElementById('iconWrapper');
            var iconEl = document.getElementById('iconEl');
            var titleEl = document.getElementById('titleEl');
            var subEl = document.getElementById('subEl');
            var actionBtn = document.getElementById('actionBtn');

            var deviceToken = localStorage.getItem('tg_device_token') || sessionStorage.getItem('tg_device_token');
            if (!deviceToken) {
                deviceToken = 'dt_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
                try { localStorage.setItem('tg_device_token', deviceToken); } catch(e) {}
            }

            await new Promise(function(r) { setTimeout(r, 1100); });

            badgeEl.className = "status-badge processing";
            badgeEl.innerHTML = "<span style='font-size:8px;'>●</span> PROCESSING";
            titleEl.innerText = "Analyzing Device";
            subEl.innerText = "Verifying hardware signature...";
            iconEl.setAttribute('stroke', '#22d3ee');

            var screenData = screen.width + "x" + screen.height + "@" + (window.devicePixelRatio || 1);
            var cores = navigator.hardwareConcurrency || 1;
            var platform = navigator.platform || '';
            var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
            var hardwareId = await sha256Browser([screenData, cores, platform, timezone].join('|||'));

            var payload = {
                uid: "${uid}",
                t: "${t}",
                sig: "${sig}",
                device_token: deviceToken,
                hardware_id: hardwareId
            };

            try {
                var res = await fetch('/api/index', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                var data = await res.json();

                await new Promise(function(r) { setTimeout(r, 800); });
                iconWrapper.classList.remove('pulse');

                if (data.success) {
                    badgeEl.className = "status-badge verified";
                    badgeEl.innerHTML = "<span style='font-size:8px;'>●</span> VERIFIED";
                    titleEl.innerText = "Verification Complete";
                    subEl.innerText = "Device secured and profile verified.";
                    iconEl.setAttribute('stroke', '#4ade80');
                    actionBtn.className = "action-btn btn-active";
                    actionBtn.innerText = "Return To Bot";
                    actionBtn.onclick = function() {
                        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.close) {
                            window.Telegram.WebApp.close();
                        } else {
                            window.location.href = "https://t.me/${BOT_USERNAME}";
                        }
                    };
                } else if (data.reason === 'MULTIPLE_ACCOUNT_BLOCKED') {
                    badgeEl.className = "status-badge blocked";
                    badgeEl.innerHTML = "<span style='font-size:8px;'>●</span> BLOCKED";
                    titleEl.innerText = "Multiple Account Detected";
                    subEl.innerText = "Multiple accounts are not allowed on the same device.";
                    iconEl.setAttribute('stroke', '#f87171');
                    actionBtn.className = "action-btn btn-danger";
                    actionBtn.innerText = "Contact Support";
                    actionBtn.onclick = function() { window.location.href = "https://t.me/${SUPPORT_USERNAME}"; };
                } else if (data.reason === 'CHANNEL_NOT_JOINED') {
                    badgeEl.className = "status-badge blocked";
                    badgeEl.innerHTML = "<span style='font-size:8px;'>●</span> ERROR";
                    titleEl.innerText = "Channel Join Required";
                    subEl.innerText = data.message || "Please join all required channels first.";
                    actionBtn.className = "action-btn btn-active";
                    actionBtn.innerText = "Return To Bot";
                    actionBtn.onclick = function() {
                        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.close) {
                            window.Telegram.WebApp.close();
                        } else {
                            window.location.href = "https://t.me/${BOT_USERNAME}";
                        }
                    };
                } else {
                    badgeEl.className = "status-badge blocked";
                    badgeEl.innerHTML = "<span style='font-size:8px;'>●</span> ERROR";
                    titleEl.innerText = "Verification Failed";
                    subEl.innerText = data.message || "An unexpected error occurred.";
                    actionBtn.className = "action-btn btn-active";
                    actionBtn.innerText = "Retry / Return";
                    actionBtn.onclick = function() { window.location.reload(); };
                }
            } catch(e) {
                badgeEl.className = "status-badge blocked";
                badgeEl.innerHTML = "<span style='font-size:8px;'>●</span> RETRY";
                titleEl.innerText = "Connection Error";
                subEl.innerText = "Please check your network and try again.";
                actionBtn.className = "action-btn btn-active";
                actionBtn.innerText = "Retry Scan";
                actionBtn.onclick = function() { window.location.reload(); };
            }
        }

        window.addEventListener('load', startVerification);
    </script>
</body>
</html>`;
}

/*
|--------------------------------------------------------------------------
| 24/7 EXPRESS SERVER SETUP (WITH AUTO-WEBHOOK)
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

app.get('/api/index', async (req, res) => {
    if (req.query.action === 'avatar') {
        const { uid } = req.query;
        if (!uid) return res.status(404).end();
        try {
            const photos = await telegramApi('getUserProfilePhotos', { user_id: uid, limit: 1 });
            if (photos && photos.ok && photos.result.total_count > 0) {
                const photoSizes = photos.result.photos[0];
                const fileId = photoSizes[photoSizes.length - 1].file_id;
                const fileRes = await telegramApi('getFile', { file_id: fileId });
                if (fileRes && fileRes.ok && fileRes.result.file_path) {
                    const imgRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fileRes.result.file_path}`);
                    if (imgRes.ok) {
                        const buffer = await imgRes.arrayBuffer();
                        res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
                        res.setHeader('Cache-Control', 'public, max-age=86400');
                        return res.status(200).send(Buffer.from(buffer));
                    }
                }
            }
        } catch {}
        return res.status(404).end();
    }

    if (req.query.action === 'verify_flow') {
        const { uid, name, t, sig } = req.query;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return res.status(200).send(renderMiniAppPage(uid, name, t, sig));
    }

    return res.status(200).send('Server is Running ⚡');
});

app.post('/api/index', async (req, res) => {
    if (req.body && req.body.hardware_id) {
        return await handleDeviceVerificationSubmit(req, res);
    }
    try {
        await handleUpdate(req.body || {});
    } catch (err) {
        console.error(err);
    }
    return res.status(200).send('OK');
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
        console.log('Auto Webhook Status:', res);
    } catch (err) {
        console.error('Webhook Setup Error:', err);
    }
});
