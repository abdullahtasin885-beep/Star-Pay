/*
|--------------------------------------------------------------------------
| STAR EARNING BOT FOR VERCEL (100% PRODUCTION READY & LAUNCH SAFE 🚀)
| - Updated with 'aura-star-pay' Firebase Database
| - Ultra-Fast Mobile Data (MB) + WiFi WebApp Engine
| - Smart Hardware Anti-Multi-Account (Admin Exempted, 1st User Safe)
| - Compact Withdraw Alert with Claim 2 Star Button
|--------------------------------------------------------------------------
*/

const crypto = require('crypto');

// 
const BOT_TOKEN = '8809628706:AAEHhxSmRzU20fdDdOAu2khXfh9haKde1MQ'; 
const BOT_USERNAME = 'AuraStarPayBot';
const APP_URL = 'https://star-pay-inky.vercel.app';
const SUPPORT_USERNAME = 'Sakib_Developer1'; // Support username without @

const SUPER_ADMIN_ID = 8045367594;

/*
|--------------------------------------------------------------------------
| NEW FIREBASE CONFIGURATION (AURA-STAR-PAY)
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
| FIREBASE AUTH & REST API
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
    const token = await getFirebaseToken();
    if (!token) return null;

    path = path.replace(/^\/+|\/+$/g, '');
    if (!path) return null;

    const url = `${FIREBASE_URL.replace(/\/+$/, '')}/${path}.json?auth=${encodeURIComponent(token)}`;
    const options = {
        method: method.toUpperCase(),
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    };
    if (data !== null) options.body = JSON.stringify(data);

    try {
        const res = await fetch(url, options);
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

    let legacy = await getSetting('withdraw_required_channel', '');
    if (Array.isArray(legacy)) legacy = legacy[0];
    legacy = String(legacy || '').trim();

    if (legacy !== '') {
        await setSetting('payment_verification_channel', legacy);
        await deleteSetting('withdraw_required_channel');
        return legacy;
    }

    await deleteSetting('withdraw_required_channel');
    return '';
}

async function getWithdrawRequestChannel() {
    let raw = await getSetting('withdraw_request_channel', '');
    if (Array.isArray(raw)) raw = raw[0];
    const channel = String(raw || '').trim();
    if (channel !== '') {
        await setSetting('withdraw_request_channel', channel);
    }
    return channel;
}

async function getGiftCodes() {
    const codes = await firebaseRequest('gift_codes');
    return codes && typeof codes === 'object' ? codes : {};
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
    if (text.length <= max) {
        return await sendMessage(chatId, text, extra);
    }
    let offset = 0;
    while (offset < text.length) {
        let chunk = text.slice(offset, offset + max);
        offset += chunk.length;
        await sendMessage(chatId, chunk, offset >= text.length ? extra : null);
    }
}

/*
|--------------------------------------------------------------------------
| STATE MANAGEMENT
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
    return String(userId) === String(SUPER_ADMIN_ID);
}

async function isAdmin(userId) {
    if (isSuperAdmin(userId)) return true;
    const admin = await firebaseRequest(`admins/${userId}`);
    return Boolean(admin && typeof admin === 'object' && admin.active);
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
| FORCE JOIN & VERIFICATION FLOW
|--------------------------------------------------------------------------
*/
async function showForceJoin(chatId) {
    const forceChannels = await getAllForceChannels();
    const keyboard = [];

    for (const ch of Object.values(forceChannels)) {
        if (ch && ch.channel_link) {
            keyboard.push([{
                text: `📢 ${ch.channel_name || 'Join Channel'}`,
                url: ch.channel_link
            }]);
        }
    }

    const paymentChannel = await getPaymentVerificationChannel();
    if (paymentChannel) {
        const link = paymentChannel.startsWith('@') ? `https://t.me/${paymentChannel.slice(1)}` : '';
        if (link) {
            keyboard.push([{
                text: '📢 Payment/Verification Channel',
                url: link
            }]);
        }
    }

    keyboard.push([{ text: '✅ Verify', callback_data: 'verify_join' }]);

    const text = 
        "📢 <b>Please join our channel first to continue.</b>\n\n" +
        "After joining, press the Verify button below.";

    await sendMessage(chatId, text, { inline_keyboard: keyboard });
}

async function sendDeviceVerificationPrompt(chatId, userId, firstName) {
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

    await sendMessage(chatId, text, keyboard);
}

/*
|--------------------------------------------------------------------------
| COMPACT WITHDRAW ALERT BUILDERS
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
| ANTI-MULTI-ACCOUNT SUBMISSION (HARDWARE-LEVEL VERIFICATION)
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

        const user = await getUser(uid);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.verification_status === 'verified') {
            return res.status(200).json({ success: true, already_verified: true });
        }

        if (user.verification_status === 'multiple_account_blocked' || user.verification_status === 'manually_blocked') {
            return res.status(403).json({ success: false, reason: 'MULTIPLE_ACCOUNT_BLOCKED' });
        }

        const joinedAll = await isUserJoinedAllChannels(uid);
        if (!joinedAll) {
            return res.status(400).json({ success: false, reason: 'CHANNEL_NOT_JOINED' });
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

            await firebaseRequest(`registered_hardware/${hardware_id}`, 'PUT', {
                user_id: String(uid),
                is_admin: false,
                created_at: now
            });
            await firebaseRequest(`registered_tokens/${deviceTokenHash}`, 'PUT', {
                user_id: String(uid),
                is_admin: false,
                created_at: now
            });
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

        const successMsg = 
            "✅ <b>Verification Successful</b>\n\n" +
            "Your Telegram account and device have been successfully verified.\n\n" +
            "Welcome! 🎉";
        await sendMessage(uid, successMsg);

        const mainMenuPrompt = 
            `🏠 <b>Main Menu</b>\n━━━━━━━━━━━━━━━━━━\n` +
            `🌟 <i>যেকোনো সুবিধা পেতে নিচের মেনু অপশনগুলো ব্যবহার করুন।</i>`;
        await sendMessage(uid, mainMenuPrompt, await getUserMenu(uid));

        return res.status(200).json({ success: true, message: 'VERIFIED' });
    } catch {
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

/*
|--------------------------------------------------------------------------
| TELEGRAM MINI APP (ZERO-TIMEOUT FAST UI)
|--------------------------------------------------------------------------
*/
function renderMiniAppPage(uid, name, t, sig) {
    const displayName = escapeHtml(decodeURIComponent(name || 'User'));
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <title>START BOT INC</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-tap-highlight-color: transparent; }
        body { background: #070d18; color: #ffffff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; overflow: hidden; }
        
        .main-card {
            background: linear-gradient(180deg, #111b2e 0%, #0b1220 100%);
            border: 1px solid rgba(56, 189, 248, 0.15);
            border-radius: 28px;
            width: 100%;
            max-width: 380px;
            padding: 24px 20px 30px;
            position: relative;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .user-header {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.07);
            margin-bottom: 25px;
        }

        .user-info { display: flex; align-items: center; gap: 12px; }
        .avatar {
            width: 46px;
            height: 46px;
            border-radius: 50%;
            background: linear-gradient(135deg, #38bdf8, #2563eb);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: bold;
            color: #fff;
            box-shadow: 0 0 15px rgba(56, 189, 248, 0.3);
        }

        .user-details h3 { font-size: 16px; font-weight: 600; color: #f8fafc; }
        .user-details p { font-size: 12px; color: #64748b; margin-top: 2px; }

        .theme-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #94a3b8;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }

        .status-badge {
            padding: 5px 16px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 30px;
        }

        .status-badge.scanning { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
        .status-badge.processing { background: rgba(6, 182, 212, 0.15); color: #22d3ee; border: 1px solid rgba(6, 182, 212, 0.3); }
        .status-badge.verified { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
        .status-badge.blocked { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }

        .circle-icon-wrapper {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(30, 58, 102, 0.5) 0%, rgba(15, 23, 42, 0.8) 100%);
            border: 2px solid rgba(56, 189, 248, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 30px;
            position: relative;
            box-shadow: 0 0 35px rgba(56, 189, 248, 0.15);
        }

        .circle-icon-wrapper.pulse::after {
            content: '';
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            border: 2px solid #38bdf8;
            animation: ripple 1.6s ease-out infinite;
        }

        @keyframes ripple {
            0% { transform: scale(1); opacity: 0.8; }
            100% { transform: scale(1.4); opacity: 0; }
        }

        .icon-svg { width: 52px; height: 52px; fill: none; }

        .title { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
        .subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 35px; text-align: center; }

        .action-btn {
            width: 100%;
            padding: 16px;
            border-radius: 16px;
            font-size: 15px;
            font-weight: 600;
            border: none;
            cursor: default;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            transition: all 0.2s;
        }

        .btn-disabled { background: #131d2e; color: #475569; }
        .btn-active {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: #ffffff;
            cursor: pointer;
            box-shadow: 0 10px 25px rgba(37, 99, 235, 0.4);
        }
        .btn-active:active { transform: scale(0.98); }
        .btn-danger {
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
            color: #ffffff;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="main-card">
        <div class="user-header">
            <div class="user-info">
                <div class="avatar">${displayName.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <h3>${displayName}</h3>
                    <p>ID: ${uid}</p>
                </div>
            </div>
            <div class="theme-btn">✨ Theme</div>
        </div>

        <div id="badgeEl" class="status-badge scanning">
            <span style="font-size: 8px;">●</span> SCANNING
        </div>

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

        async function sha256Browser(str) {
            try {
                var buffer = new TextEncoder().encode(str);
                var hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
                return Array.from(new Uint8Array(hashBuffer)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
            } catch(e) {
                return 'h_' + btoa(str).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
            }
        }

        function getGPU() {
            try {
                var canvas = document.createElement('canvas');
                var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (!gl) return 'no-webgl';
                var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'gl-renderer';
            } catch(e) {
                return 'unknown-gpu';
            }
        }

        function getCanvasHash() {
            try {
                var canvas = document.createElement('canvas');
                canvas.width = 200;
                canvas.height = 50;
                var ctx = canvas.getContext('2d');
                ctx.textBaseline = "alphabetic";
                ctx.fillStyle = "#f60";
                ctx.fillRect(80, 5, 70, 25);
                ctx.fillStyle = "#069";
                ctx.font = "14px 'Arial'";
                ctx.fillText("StarBotSecurity,1122", 4, 16);
                return canvas.toDataURL();
            } catch(e) {
                return 'canvas-na';
            }
        }

        async function startVerification() {
            var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
            if (tg) {
                try { tg.ready(); tg.expand(); } catch(e) {}
            }

            var badgeEl = document.getElementById('badgeEl');
            var iconWrapper = document.getElementById('iconWrapper');
            var iconEl = document.getElementById('iconEl');
            var titleEl = document.getElementById('titleEl');
            var subEl = document.getElementById('subEl');
            var actionBtn = document.getElementById('actionBtn');

            var deviceToken = localStorage.getItem('tg_device_token') || sessionStorage.getItem('tg_device_token');
            if (!deviceToken) {
                deviceToken = 'dt_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
                try {
                    localStorage.setItem('tg_device_token', deviceToken);
                    sessionStorage.setItem('tg_device_token', deviceToken);
                } catch(e) {}
            }
            document.cookie = "tg_device_token=" + deviceToken + "; path=/; max-age=31536000; SameSite=Lax";

            await new Promise(function(r) { setTimeout(r, 1100); });

            badgeEl.className = "status-badge processing";
            badgeEl.innerHTML = "<span style='font-size:8px;'>●</span> PROCESSING";
            titleEl.innerText = "Analyzing Device";
            subEl.innerText = "Verifying hardware signature...";
            iconEl.setAttribute('stroke', '#22d3ee');
            iconEl.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 5h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2zM9 9h6v6H9V9z"/>';

            var gpu = getGPU();
            var canvasData = getCanvasHash();
            var screenData = screen.width + "x" + screen.height + "x" + screen.colorDepth + "@" + (window.devicePixelRatio || 1);
            var cores = navigator.hardwareConcurrency || 1;
            var touchPoints = navigator.maxTouchPoints || 0;
            var platform = navigator.platform || '';
            var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

            var rawHardware = [gpu, canvasData, screenData, cores, touchPoints, platform, timezone].join('|||');
            var hardwareId = await sha256Browser(rawHardware);

            var payload = {
                uid: "${uid}",
                t: "${t}",
                sig: "${sig}",
                device_token: deviceToken,
                hardware_id: hardwareId,
                fingerprint: { gpu: gpu, screen: screenData, cores: cores, platform: platform, timezone: timezone }
            };

            try {
                var res = await fetch('${APP_URL}/api/index', {
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
                    iconEl.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>';
                    
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
                    iconEl.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>';

                    actionBtn.className = "action-btn btn-danger";
                    actionBtn.innerText = "Contact Support";
                    actionBtn.onclick = function() {
                        window.location.href = "https://t.me/${SUPPORT_USERNAME}";
                    };
                } else {
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

        if (document.readyState === 'complete') {
            startVerification();
        } else {
            window.addEventListener('load', startVerification);
        }
    </script>
</body>
</html>`;
}

/*
|--------------------------------------------------------------------------
| MAIN TELEGRAM UPDATE HANDLER
|--------------------------------------------------------------------------
*/
async function handleUpdate(update) {
    if (update.callback_query) {
        const callback = update.callback_query;
        const fromId = String(callback.from.id);
        const data = callback.data || '';
        const chatId = callback.message?.chat?.id;
        const messageId = callback.message?.message_id;

        if (data === 'verify_join') {
            const joinedAll = await isUserJoinedAllChannels(fromId);
            if (!joinedAll) {
                await answerCallback(callback.id);
                await sendMessage(chatId, "❌ <b>আপনি প্রয়োজনীয় চ্যানেলে জয়েন করেননি!</b>\n\nঅনুগ্রহ করে সব চ্যানেলে জয়েন করে আবার Verify বাটনে চাপ দিন।");
                return;
            }

            const user = await getUser(fromId);
            if (user && user.verification_status === 'verified') {
                await answerCallback(callback.id);
                if (chatId && messageId) await deleteMessage(chatId, messageId);
                await sendMessage(fromId, "✅ <b>Verification Successful</b>\n\nWelcome back! 🎉", await getUserMenu(fromId));
                return;
            }

            if (user && user.verification_status === 'multiple_account_blocked') {
                await answerCallback(callback.id);
                if (chatId && messageId) await deleteMessage(chatId, messageId);
                const blockMsg = 
                    "🚫 <b>Multiple Account Detected</b>\n\n" +
                    "Multiple accounts are not allowed on the same device.\n\n" +
                    "Your account could not be verified because another Telegram account is already verified from this device.\n\n" +
                    "If you believe this is a mistake, please contact support.";
                await sendMessage(fromId, blockMsg, {
                    inline_keyboard: [[{ text: '👨‍💻 Contact Support', url: `https://t.me/${SUPPORT_USERNAME}` }]]
                });
                return;
            }

            await answerCallback(callback.id);
            if (chatId && messageId) {
                await deleteMessage(chatId, messageId);
            }

            await sendMessage(chatId, "✅ <b>Channel Verification Successful</b>");
            await sendDeviceVerificationPrompt(chatId, fromId, callback.from.first_name);
            return;
        }

        if (data === 'leaderboard') {
            const users = await getAllUsers();
            const sortedUsers = Object.values(users)
                .filter(u => u && u.total_referrals > 0)
                .sort((a, b) => Number(b.total_referrals || 0) - Number(a.total_referrals || 0))
                .slice(0, 10);

            let leaderText = "🏆 <b>TOP REFERRAL LEADERBOARD</b>\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
            if (!sortedUsers.length) {
                leaderText += "এখনো কোনো লিডারবোর্ড রেকর্ড নেই।";
            } else {
                sortedUsers.forEach((u, i) => {
                    const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `<b>${i + 1}.</b>`));
                    leaderText += `${medal} <b>${escapeHtml(u.first_name || 'User')}</b> — <b>${u.total_referrals}</b> Referrals\n`;
                });
            }
            await answerCallback(callback.id, 'Leaderboard Loaded');
            await sendMessage(fromId, leaderText);
            return;
        }

        const match = data.match(/^withdraw_(approve|reject)_([A-Za-z0-9_-]+)$/);
        if (match) {
            if (!(await isAdmin(fromId))) {
                await answerCallback(callback.id, '⛔ Permission Denied!', true);
                return;
            }
            const action = match[1];
            const withdrawId = match[2];
            const withdraw = await firebaseRequest(`withdrawals/${withdrawId}`);

            if (!withdraw || withdraw.status !== 'pending') {
                await answerCallback(callback.id, '⚠️ Request already processed!', true);
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
                await answerCallback(callback.id, '✅ Approved!');
                await sendMessage(withdraw.user_id, `🎉 <b>Withdrawal Approved!</b>\n\n💰 Amount: <b>${formatNumber(withdraw.after_fee)} STAR</b>\n🧾 ID: <code>${withdraw.transaction_id}</code>`);
                
                if (chatId && messageId) {
                    await sendReplyMessage(chatId, messageId, buildApprovedAlertText(withdraw, adminUsername), claimOnlyKeyboard());
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
                await answerCallback(callback.id, '❌ Rejected & Refunded!');
                await sendMessage(withdraw.user_id, `❌ <b>Withdrawal Rejected</b>\n\n${formatNumber(withdraw.amount)} STAR balance-এ রিফান্ড করা হয়েছে।`);
                
                if (chatId && messageId) {
                    await sendReplyMessage(chatId, messageId, buildRejectedAlertText(withdraw, adminUsername), claimOnlyKeyboard());
                }
                return;
            }
        }

        if (await isAdmin(fromId)) {
            if (data === 'admin_add' && isSuperAdmin(fromId)) {
                await setAdminState(fromId, 'add_admin');
                await answerCallback(callback.id, 'Admin ID পাঠান');
                await sendMessage(fromId, "➕ <b>নতুন এডমিন যোগ করুন</b>\n\nযে Telegram User ID-কে Admin করতে চান সেটি পাঠান:", getCancelKeyboard());
                return;
            }
            if (data === 'admin_remove' && isSuperAdmin(fromId)) {
                await setAdminState(fromId, 'remove_admin');
                await answerCallback(callback.id, 'Admin ID পাঠান');
                await sendMessage(fromId, "➖ <b>এডমিন রিমুভ করুন</b>\n\nযে Admin-কে Remove করতে চান তার Telegram ID পাঠান:", getCancelKeyboard());
                return;
            }
            if (data === 'admin_list' && isSuperAdmin(fromId)) {
                const admins = await getAllAdmins();
                let list = `👮 <b>এডমিন তালিকা</b>\n━━━━━━━━━━━━━━━━━━\n\n👑 <b>Super Admin</b>\n🆔 <code>${SUPER_ADMIN_ID}</code>\n\n👮 <b>অন্যান্য Admin</b>\n`;
                let has = false;
                for (const [aId, a] of Object.entries(admins)) {
                    if (a && a.active) { has = true; list += `\n• <code>${escapeHtml(aId)}</code>`; }
                }
                if (!has) list += "\nকোনো অতিরিক্ত Admin নেই।";
                await answerCallback(callback.id, 'Loaded');
                await sendMessage(fromId, list);
                return;
            }
            if (data === 'force_add') {
                await setAdminState(fromId, 'add_force_channel_id');
                await answerCallback(callback.id, 'Channel ID পাঠান');
                await sendMessage(fromId, "➕ <b>ফোর্স চ্যানেল যোগ করুন</b>\n\nChannel ID পাঠান (যেমন: <code>-1001234567890</code>):", getCancelKeyboard());
                return;
            }
            if (data === 'force_remove') {
                const channels = await getAllForceChannels();
                if (!Object.keys(channels).length) { await answerCallback(callback.id, 'কোনো Channel নেই!'); return; }
                const kb = [];
                for (const [k, c] of Object.entries(channels)) {
                    if (c) kb.push([{ text: `❌ ${c.channel_name || 'Unknown'}`, callback_data: `removeforce_${k}` }]);
                }
                await answerCallback(callback.id, 'Select');
                await sendMessage(fromId, "📢 <b>ফোর্স চ্যানেল রিমুভ</b>\n\nতালিকা থেকে Channel নির্বাচন করুন:", { inline_keyboard: kb });
                return;
            }
            const removeMatch = data.match(/^removeforce_([A-Za-z0-9_-]+)$/);
            if (removeMatch) {
                await firebaseRequest(`force_channels/${removeMatch[1]}`, 'DELETE');
                await answerCallback(callback.id, 'Removed');
                await sendMessage(fromId, "✅ <b>চ্যানেল সফলভাবে রিমুভ করা হয়েছে!</b>", getAdminMenu(isSuperAdmin(fromId)));
                return;
            }
            if (data === 'force_list') {
                const channels = await getAllForceChannels();
                let list = "📢 <b>ফোর্স চ্যানেল তালিকা</b>\n━━━━━━━━━━━━━━━━━━\n";
                if (!Object.keys(channels).length) list += "\nকোনো Force Join Channel নেই।";
                else {
                    for (const [k, c] of Object.entries(channels)) {
                        if (c) list += `\n\n🔹 <b>${escapeHtml(c.channel_name || '')}</b>\n🆔 ID: <code>${escapeHtml(c.channel_id || '')}</code>\n🔗 Link: <code>${escapeHtml(c.channel_link || '')}</code>`;
                    }
                }
                await answerCallback(callback.id, 'Loaded');
                await sendLongMessage(fromId, list);
                return;
            }
            
            if (data === 'balance_add') {
                await setAdminState(fromId, 'add_balance_user');
                await answerCallback(callback.id, 'User ID পাঠান');
                await sendMessage(fromId, "➕ <b>ব্যালেন্স যোগ (ধাপ ১/২)</b>\n\n👤 ইউজারের <b>Telegram User ID</b> পাঠান:", getCancelKeyboard());
                return;
            }
            
            if (data === 'balance_cut') {
                await setAdminState(fromId, 'cut_balance_user');
                await answerCallback(callback.id, 'User ID পাঠান');
                await sendMessage(fromId, "➖ <b>ব্যালেন্স কাটুন (ধাপ ১/২)</b>\n\n👤 ইউজারের <b>Telegram User ID</b> পাঠান:", getCancelKeyboard());
                return;
            }

            if (data === 'bonus_welcome') {
                await setAdminState(fromId, 'welcome_bonus');
                await answerCallback(callback.id, 'Send amount');
                const cur = Number(await getSetting('welcome_bonus', 0));
                await sendMessage(fromId, `🎁 <b>Welcome Bonus:</b> <b>${formatNumber(cur)} ⭐</b>\n\nনতুন Amount পাঠান:`, getCancelKeyboard());
                return;
            }
            if (data === 'bonus_referral') {
                await setAdminState(fromId, 'referral_bonus');
                await answerCallback(callback.id, 'Send amount');
                const cur = Number(await getSetting('referral_bonus', 0));
                await sendMessage(fromId, `👥 <b>Referral Bonus:</b> <b>${formatNumber(cur)} ⭐</b>\n\nনতুন Amount পাঠান:`, getCancelKeyboard());
                return;
            }
            if (data === 'withdraw_minimum') {
                await setAdminState(fromId, 'minimum_withdraw');
                await answerCallback(callback.id, 'Send amount');
                const cur = Number(await getSetting('min_withdraw', 15));
                await sendMessage(fromId, `💸 <b>Fixed Withdraw Amount:</b> <b>${formatNumber(cur)} ⭐</b>\n\nনতুন Amount পাঠান:`, getCancelKeyboard());
                return;
            }
            if (data === 'withdraw_fee') {
                await setAdminState(fromId, 'withdraw_fee');
                await answerCallback(callback.id, 'Send fee');
                const cur = Number(await getSetting('withdraw_fee_percent', 0));
                await sendMessage(fromId, `📊 <b>Withdrawal Fee:</b> <b>${formatNumber(cur)}%</b>\n\nPercentage পাঠান (0-100):`, getCancelKeyboard());
                return;
            }
            if (data === 'payment_channel_set') {
                await setAdminState(fromId, 'payment_verification_channel');
                await answerCallback(callback.id, 'Send channel');
                const current = await getPaymentVerificationChannel();
                await sendMessage(fromId, `📢 <b>Payment Channel</b>\n\n<code>@channelusername</code> অথবা ID দিন:\n\nবর্তমান: <b>${current || 'Not Set'}</b>`, getCancelKeyboard());
                return;
            }
            if (data === 'withdraw_request_channel_set') {
                await setAdminState(fromId, 'withdraw_request_channel');
                await answerCallback(callback.id, 'Send channel');
                const current = await getWithdrawRequestChannel();
                await sendMessage(fromId, `💸 <b>Withdraw Request Channel</b>\n\n<code>@channelusername</code> অথবা ID দিন:\n\nবর্তমান: <b>${current || 'Not Set'}</b>`, getCancelKeyboard());
                return;
            }
            if (data === 'gift_create') {
                await setAdminState(fromId, 'gift_code');
                await answerCallback(callback.id, 'Send details');
                await sendMessage(fromId, "🎁 <b>Gift Code তৈরি</b>\n\nFormat: <code>CODE | STAR_AMOUNT | MAX_USERS</code>\nExample: <code>STAR50 | 5 | 100</code>", getCancelKeyboard());
                return;
            }
            if (data === 'gift_list') {
                const codes = (await firebaseRequest('gift_codes')) || {};
                let out = "🎁 <b>Gift Code তালিকা</b>\n━━━━━━━━━━━━━━━━━━";
                if (!Object.keys(codes).length) out += "\n\nকোনো Gift Code নেই।";
                else {
                    for (const [code, gift] of Object.entries(codes)) {
                        if (gift) out += `\n\n🎁 <code>${escapeHtml(code)}</code> | ⭐ <b>${formatNumber(Number(gift.amount || 0))} STAR</b> | 👥 <b>${gift.used_count || 0}/${gift.max_users || 0}</b>`;
                    }
                }
                await answerCallback(callback.id, 'Loaded');
                await sendLongMessage(fromId, out);
                return;
            }
        }
    }

    if (update.message && update.message.text) {
        const msg = update.message;
        const fromId = String(msg.from.id);
        const chatId = String(msg.chat.id);
        const text = normalizeText(msg.text);
        const isAdm = isSuperAdmin(fromId) || (await isAdmin(fromId));

        let user = await getUser(fromId);
        if (!user) {
            let refBy = null;
            const startMatch = text.match(/^\/start\s+(\d+)$/i);
            if (startMatch && startMatch[1] !== fromId && (await getUser(startMatch[1]))) {
                refBy = startMatch[1];
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

        if (text.toLowerCase() === '/cancel') {
            await clearAdminState(fromId);
            await clearUserState(fromId);
            await updateUser(fromId, { withdraw_state: null });
            await sendMessage(chatId, "❌ অপারেশন বাতিল করা হয়েছে।", await getUserMenu(fromId));
            return;
        }

        if (isAdm) {
            const aState = await getAdminState(fromId);
            if (aState && aState.action) {
                const action = aState.action;

                if (action === 'add_admin') {
                    if (/^\d+$/.test(text)) {
                        await firebaseRequest(`admins/${text}`, 'PUT', { active: true, added_by: fromId, added_at: Math.floor(Date.now() / 1000) });
                        await clearAdminState(fromId);
                        await sendMessage(chatId, "🎉 <b>Admin Added Successfully!</b>", getAdminMenu(true));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক Numeric ID দিন:", getCancelKeyboard());
                    }
                    return;
                }

                if (action === 'remove_admin') {
                    if (/^\d+$/.test(text) && text !== String(SUPER_ADMIN_ID)) {
                        await firebaseRequest(`admins/${text}`, 'DELETE');
                        await clearAdminState(fromId);
                        await sendMessage(chatId, "✅ <b>Admin Removed Successfully!</b>", getAdminMenu(true));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক ID পাঠান:", getCancelKeyboard());
                    }
                    return;
                }

                if (action === 'add_force_channel_id') {
                    if (/^-100\d+$/.test(text)) {
                        await setAdminState(fromId, 'add_force_channel_link', { channel_id: text });
                        await sendMessage(chatId, "🔗 <b>Channel Link দিন:</b>\n\nExample: <code>https://t.me/example</code>", getCancelKeyboard());
                    } else {
                        await sendMessage(chatId, "❌ সঠিক Channel ID দিন:", getCancelKeyboard());
                    }
                    return;
                }

                if (action === 'add_force_channel_link') {
                    let link = text.trim();
                    if (link.startsWith('@')) link = 'https://t.me/' + link.slice(1);
                    await setAdminState(fromId, 'add_force_channel_name', { channel_id: aState.channel_id, channel_link: link });
                    await sendMessage(chatId, "🔘 <b>Button Name দিন:</b>", getCancelKeyboard());
                    return;
                }

                if (action === 'add_force_channel_name') {
                    await firebaseRequest('force_channels', 'POST', {
                        channel_id: aState.channel_id,
                        channel_link: aState.channel_link,
                        channel_name: text,
                        added_by: fromId,
                        added_at: Math.floor(Date.now() / 1000)
                    });
                    await clearAdminState(fromId);
                    await sendMessage(chatId, "🎉 <b>Force Join Channel Added!</b>", getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (action === 'add_balance_user') {
                    if (!/^\d+$/.test(text)) {
                        await sendMessage(chatId, "❌ সঠিক Numeric User ID পাঠান:", getCancelKeyboard());
                        return;
                    }
                    const targetUser = await getUser(text);
                    if (!targetUser) {
                        await sendMessage(chatId, "❌ ইউজার পাওয়া যায়নি!", getCancelKeyboard());
                        return;
                    }
                    await setAdminState(fromId, 'add_balance_amount', {
                        target_id: text,
                        target_name: targetUser.first_name || 'User',
                        current_bal: Number(targetUser.balance || 0)
                    });
                    await sendMessage(chatId, `👤 <b>${escapeHtml(targetUser.first_name || 'User')}</b> (<code>${text}</code>)\n💰 ব্যালেন্স: <b>${formatNumber(Number(targetUser.balance || 0))} ⭐</b>\n\nকত STAR যোগ করতে চান?`, getCancelKeyboard());
                    return;
                }

                if (action === 'add_balance_amount') {
                    if (!isNumericAmount(text) || Number(text) <= 0) {
                        await sendMessage(chatId, "❌ সঠিক Amount দিন:", getCancelKeyboard());
                        return;
                    }
                    const amt = Number(text);
                    const targetId = aState.target_id;
                    const targetUser = await getUser(targetId);
                    if (targetUser) {
                        const newBal = Number(targetUser.balance || 0) + amt;
                        await updateUser(targetId, { balance: newBal });
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>Added +${formatNumber(amt)} ⭐</b>\n💰 New Balance: <b>${formatNumber(newBal)} ⭐</b>`, getAdminMenu(isSuperAdmin(fromId)));
                        
                        try {
                            await sendMessage(targetId, `🎁 <b>আপনার অ্যাকাউন্টে +${formatNumber(amt)} STAR যোগ করা হয়েছে!</b>\n💰 বর্তমান ব্যালেন্স: <b>${formatNumber(newBal)} STAR ⭐</b>`);
                        } catch {}
                    }
                    return;
                }

                if (action === 'cut_balance_user') {
                    if (!/^\d+$/.test(text)) {
                        await sendMessage(chatId, "❌ সঠিক Numeric User ID পাঠান:", getCancelKeyboard());
                        return;
                    }
                    const targetUser = await getUser(text);
                    if (!targetUser) {
                        await sendMessage(chatId, "❌ ইউজার পাওয়া যায়নি!", getCancelKeyboard());
                        return;
                    }
                    await setAdminState(fromId, 'cut_balance_amount', {
                        target_id: text,
                        target_name: targetUser.first_name || 'User',
                        current_bal: Number(targetUser.balance || 0)
                    });
                    await sendMessage(chatId, `👤 <b>${escapeHtml(targetUser.first_name || 'User')}</b> (<code>${text}</code>)\n💰 ব্যালেন্স: <b>${formatNumber(Number(targetUser.balance || 0))} ⭐</b>\n\nকত STAR কাটতে চান?`, getCancelKeyboard());
                    return;
                }

                if (action === 'cut_balance_amount') {
                    if (!isNumericAmount(text) || Number(text) <= 0) {
                        await sendMessage(chatId, "❌ সঠিক Amount দিন:", getCancelKeyboard());
                        return;
                    }
                    const amt = Number(text);
                    const targetId = aState.target_id;
                    const targetUser = await getUser(targetId);
                    if (targetUser) {
                        const cur = Number(targetUser.balance || 0);
                        const newBal = Math.max(0, cur - amt);
                        await updateUser(targetId, { balance: newBal });
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>Deducted -${formatNumber(amt)} ⭐</b>\n💰 New Balance: <b>${formatNumber(newBal)} ⭐</b>`, getAdminMenu(isSuperAdmin(fromId)));
                        
                        try {
                            await sendMessage(targetId, `⚠️ <b>আপনার অ্যাকাউন্ট থেকে -${formatNumber(amt)} STAR কাটা হয়েছে!</b>\n💰 বর্তমান ব্যালেন্স: <b>${formatNumber(newBal)} STAR ⭐</b>`);
                        } catch {}
                    }
                    return;
                }

                if (action === 'welcome_bonus' && isNumericAmount(text)) {
                    await setSetting('welcome_bonus', Number(text));
                    await clearAdminState(fromId);
                    await sendMessage(chatId, `🎁 <b>Welcome Bonus:</b> <b>${formatNumber(Number(text))} ⭐</b>`, getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (action === 'referral_bonus' && isNumericAmount(text)) {
                    await setSetting('referral_bonus', Number(text));
                    await clearAdminState(fromId);
                    await sendMessage(chatId, `👥 <b>Referral Bonus:</b> <b>${formatNumber(Number(text))} ⭐</b>`, getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (action === 'minimum_withdraw' && isNumericAmount(text)) {
                    await setSetting('min_withdraw', Number(text));
                    await clearAdminState(fromId);
                    await sendMessage(chatId, `💸 <b>Fixed Withdraw:</b> <b>${formatNumber(Number(text))} ⭐</b>`, getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (action === 'withdraw_fee' && isNumericAmount(text)) {
                    await setSetting('withdraw_fee_percent', Number(text));
                    await clearAdminState(fromId);
                    await sendMessage(chatId, `📊 <b>Fee:</b> <b>${formatNumber(Number(text))}%</b>`, getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (action === 'payment_verification_channel' && isValidChannelTarget(text)) {
                    await setSetting('payment_verification_channel', text.trim());
                    await clearAdminState(fromId);
                    await sendMessage(chatId, "✅ <b>Payment Channel Updated!</b>", getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (action === 'withdraw_request_channel' && isValidChannelTarget(text)) {
                    await setSetting('withdraw_request_channel', text.trim());
                    await clearAdminState(fromId);
                    await sendMessage(chatId, "✅ <b>Withdraw Request Channel Updated!</b>", getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (action === 'gift_code') {
                    const parts = text.split('|').map(s => s.trim());
                    if (parts.length === 3 && isNumericAmount(parts[1]) && /^\d+$/.test(parts[2])) {
                        await firebaseRequest(`gift_codes/${parts[0].toUpperCase()}`, 'PUT', {
                            amount: Number(parts[1]),
                            max_users: Number(parts[2]),
                            used_count: 0,
                            created_by: fromId,
                            created_at: Math.floor(Date.now() / 1000),
                            active: true
                        });
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `🎉 <b>Gift Code Created:</b> <code>${escapeHtml(parts[0].toUpperCase())}</code>`, getAdminMenu(isSuperAdmin(fromId)));
                        return;
                    }
                    await sendMessage(chatId, "❌ Format: <code>CODE | STAR_AMOUNT | MAX_USERS</code>", getCancelKeyboard());
                    return;
                }

                if (action === 'broadcast' && text) {
                    await clearAdminState(fromId);
                    const users = await getAllUsers();
                    let s = 0, f = 0;
                    for (const uid of Object.keys(users)) {
                        const r = await sendMessage(uid, text);
                        if (r && r.ok) s++; else f++;
                    }
                    await sendMessage(chatId, `📢 <b>Broadcast:</b> Sent ${s}, Failed ${f}`, getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }
            }
        }

        if (!isAdm) {
            const uState = await getUserState(fromId);
            if (uState && uState.action === 'withdraw_username') {
                const target = normalizeTelegramUsernameInput(text);
                if (!isValidTelegramUsername(target)) {
                    await sendMessage(chatId, "❌ সঠিক Username দিন: <code>@username</code>", getCancelKeyboard());
                    return;
                }
                const u = await getUser(fromId);
                const fixedAmount = Number(await getSetting('min_withdraw', 15));
                const currentBalance = Number(u?.balance || 0);

                if (currentBalance < fixedAmount) {
                    await sendMessage(chatId, `⚠️ <b>Insufficient Balance!</b>\n\nপ্রয়োজন: <b>${formatNumber(fixedAmount)} STAR</b>\nআপনার ব্যালেন্স: <b>${formatNumber(currentBalance)} STAR</b>`, await getUserMenu(fromId));
                    await clearUserState(fromId);
                    return;
                }

                const paymentChannel = await getPaymentVerificationChannel();
                let paymentChannelDisplay = escapeHtml(paymentChannel);
                if (paymentChannel.startsWith('@')) {
                    const cleanUsername = paymentChannel.slice(1);
                    paymentChannelDisplay = `<a href="https://t.me/${cleanUsername}">@${cleanUsername}</a>`;
                } else if (paymentChannel.startsWith('https://t.me/')) {
                    paymentChannelDisplay = `<a href="${paymentChannel}">পেমেন্ট চ্যানেল</a>`;
                }

                const fee = Number(await getSetting('withdraw_fee_percent', 0));
                const afterFee = Math.max(0, fixedAmount - (fixedAmount * fee / 100));
                const txId = `${fromId}${Math.floor(Date.now() / 1000)}`;

                const reqChannel = await getWithdrawRequestChannel();
                if (!reqChannel) {
                    await sendMessage(chatId, "⚠️ Withdraw Channel Configured নেই।");
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

                const created = await firebaseRequest('withdrawals', 'POST', withdrawData);
                if (created && created.name) {
                    await updateUser(fromId, { balance: Math.max(0, currentBalance - fixedAmount) });
                    await clearUserState(fromId);

                    await sendMessage(reqChannel, buildPendingAlertText(withdrawData), withdrawActionKeyboard(created.name));

                    if (paymentChannel && paymentChannel !== reqChannel) {
                        try {
                            await sendMessage(paymentChannel, buildPendingAlertText(withdrawData), claimOnlyKeyboard());
                        } catch {}
                    }

                    const withdrawConfirmText = 
                        `🔔 <b>Withdrawal Submitted!</b>\n` +
                        `━━━━━━━━━━━━━━━━━━\n\n` +
                        `💰 Amount: <b>${formatNumber(fixedAmount)} STAR</b>\n` +
                        `📊 Fee: <b>${formatNumber(fee)}%</b>\n` +
                        `💵 After Fee: <b>${formatNumber(afterFee)} STAR</b>\n` +
                        `📬 To: <b>${escapeHtml(target)}</b>\n` +
                        `🧾 ID: <code>${txId}</code>\n` +
                        `📌 Status: <b>PENDING ⏳</b>\n\n` +
                        `━━━━━━━━━━━━━━━━━━\n` +
                        `⚠️ <i>অফিশিয়াল পেমেন্ট চ্যানেলে জয়েন না থাকলে উইথড্র এপ্রুভ হবে না:</i> ${paymentChannelDisplay}`;

                    await sendMessage(chatId, withdrawConfirmText, await getUserMenu(fromId));
                }
                return;
            }

            if (uState && uState.action === 'gift_redeem') {
                const code = text.trim().toUpperCase();
                const gift = await firebaseRequest(`gift_codes/${code}`);
                if (!gift || !gift.active || Number(gift.used_count || 0) >= Number(gift.max_users || 0)) {
                    await sendMessage(chatId, "❌ <b>Invalid or Expired Gift Code!</b>", await getUserMenu(fromId));
                    await clearUserState(fromId);
                    return;
                }
                const claim = await firebaseRequest(`gift_claims/${code}/${fromId}`);
                if (claim) {
                    await sendMessage(chatId, "⚠️ <b>Already Redeemed!</b>", await getUserMenu(fromId));
                    await clearUserState(fromId);
                    return;
                }
                const reward = Number(gift.amount || 0);
                const u = await getUser(fromId);
                await updateUser(fromId, { balance: Number(u?.balance || 0) + reward });
                await firebaseRequest(`gift_claims/${code}/${fromId}`, 'PUT', { claimed_at: Math.floor(Date.now() / 1000), reward: reward });
                await firebaseRequest(`gift_codes/${code}`, 'PATCH', { used_count: Number(gift.used_count || 0) + 1 });
                await clearUserState(fromId);
                await sendMessage(chatId, `🎉 <b>Gift Code Redeemed!</b>\n\n⭐ <b>+${formatNumber(reward)} STAR</b>`, await getUserMenu(fromId));
                return;
            }
        }

        // STRICT VERIFICATION PROTECTION (MENU LOCK FOR UNVERIFIED USERS)
        if (!isAdm) {
            const isVerified = user.verification_status === 'verified';
            if (!isVerified) {
                if (user.verification_status === 'multiple_account_blocked') {
                    const blockMsg = 
                        "🚫 <b>Multiple Account Detected</b>\n\n" +
                        "Multiple accounts are not allowed on the same device.\n\n" +
                        "If you believe this is a mistake, please contact support.";
                    await sendMessage(chatId, blockMsg, {
                        inline_keyboard: [[{ text: '👨‍💻 Contact Support', url: `https://t.me/${SUPPORT_USERNAME}` }]]
                    });
                    return;
                }

                const joined = await isUserJoinedAllChannels(fromId);
                if (!joined) {
                    await showForceJoin(chatId);
                    return;
                } else {
                    await sendDeviceVerificationPrompt(chatId, fromId, msg.from.first_name);
                    return;
                }
            }
        }

        // START COMMAND
        if (text.startsWith('/start')) {
            const politeStartText = 
                `🌟 <b>Welcome, ${escapeHtml(msg.from.first_name || 'User')}!</b>\n\n` +
                `Earn Telegram Stars easily and withdraw directly.`;

            await sendMessage(chatId, politeStartText, await getUserMenu(fromId));
            return;
        }

        if (text === '🛠 Admin Panel' && isAdm) {
            await clearAdminState(fromId);
            await sendMessage(chatId, "🛠 <b>Admin Panel Activated</b>", getAdminMenu(isSuperAdmin(fromId)));
            return;
        }

        if (text === '🔙 ইউজার প্যানেলে ফিরে যান') {
            await clearAdminState(fromId);
            await clearUserState(fromId);
            await updateUser(fromId, { withdraw_state: null });
            await sendMessage(chatId, "👤 <b>User Panel Activated</b>", await getUserMenu(fromId));
            return;
        }

        if (text === '👤 My Account') {
            const u = await getUser(fromId);
            await sendMessage(chatId, `👤 <b>MY ACCOUNT</b>\n━━━━━━━━━━━━━━━━━━\n\n👤 Name: <b>${escapeHtml(msg.from.first_name || 'User')}</b>\n🆔 ID: <code>${fromId}</code>\n⭐ Balance: <b>${formatNumber(u?.balance || 0)} STAR</b>\n👥 Referrals: <b>${u?.total_referrals || 0}</b>`);
            return;
        }

        if (text === '👥 Refer & Earn') {
            const u = await getUser(fromId);
            const refCount = Number(u?.total_referrals || 0);
            const refBonus = Number(await getSetting('referral_bonus', 0));
            const link = `https://t.me/${BOT_USERNAME}?start=${fromId}`;
            const shareText = encodeURIComponent(`🌟 Join our Star Earning Bot and earn free Telegram Stars! 🚀\n\nLink: ${link}`);
            const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${shareText}`;

            const refMessage = 
                `👋 <b>Welcome, ${escapeHtml(msg.from.first_name || 'User')}!</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🎁 <b>Referral Center</b>\n\n` +
                `👥 <b>Total Referrals :</b> <b>${refCount}</b>\n` +
                `💰 <b>Reward Per Referral :</b> <b>${formatNumber(refBonus)} ⭐</b>\n\n` +
                `🔗 <b>Your Referral Link:</b>\n` +
                `<code>${link}</code>\n\n` +
                `🏆 <i>Invite more friends and reach the top leaderboard!</i>`;

            const refKeyboard = {
                inline_keyboard: [
                    [
                        { text: '🚀 Share', url: shareUrl },
                        { text: '🏆 Leaderboard', callback_data: 'leaderboard' }
                    ]
                ]
            };

            await sendMessage(chatId, refMessage, refKeyboard);
            return;
        }

        if (text === '💸 Withdraw') {
            const u = await getUser(fromId);
            const bal = Number(u?.balance || 0);
            const fixedAmount = Number(await getSetting('min_withdraw', 15));

            if (bal < fixedAmount) {
                await sendMessage(chatId, `⚠️ <b>Insufficient Balance!</b>\n\nMinimum Withdraw: <b>${formatNumber(fixedAmount)} STAR</b>\nYour Balance: <b>${formatNumber(bal)} STAR</b>`);
                return;
            }

            await setUserState(fromId, 'withdraw_username');
            const withdrawPrompt = 
                `💸 <b>WITHDRAW STARS</b>\n━━━━━━━━━━━━━━━━━━\n\n` +
                `💰 Fixed Amount: <b>${formatNumber(fixedAmount)} STAR</b>\n\n` +
                `Telegram Username দিন:\n` +
                `Example: <code>@username</code>`;

            await sendMessage(chatId, withdrawPrompt, getCancelKeyboard());
            return;
        }

        if (text === '🎁 Gift Code' && !isAdm) {
            await setUserState(fromId, 'gift_redeem');
            await sendMessage(chatId, "🎁 <b>REDEEM GIFT CODE</b>\n\nGift Code পাঠান:", getCancelKeyboard());
            return;
        }

        if (text === '📜 History') {
            const history = await getUserWithdrawals(fromId);
            if (!history.length) {
                await sendMessage(chatId, "📜 কোনো Withdrawal হিস্টোরি নেই।");
                return;
            }
            let out = "📜 <b>YOUR WITHDRAWAL HISTORY</b>\n━━━━━━━━━━━━━━━━━━\n";
            for (const h of history) {
                out += `\n• <b>${h.status.toUpperCase()}</b>: ${formatNumber(h.amount)} STAR (${h.withdraw_username})`;
            }
            await sendMessage(chatId, out);
            return;
        }

        if (isAdm) {
            if (text === '📊 পরিসংখ্যান') {
                const users = await getAllUsers();
                const withdrawals = (await firebaseRequest('withdrawals')) || {};
                await sendMessage(chatId, `📊 <b>বট পরিসংখ্যান</b>\n\n👥 মোট ইউজার: <b>${Object.keys(users).length}</b>\n💸 মোট Withdrawal: <b>${Object.keys(withdrawals).length}</b>`);
                return;
            }
            if (text === '👥 User & Balance Management') {
                await sendMessage(chatId, "👥 <b>User & Balance Management</b>", balanceKeyboard());
                return;
            }
            if (text === '📢 Channel Settings') {
                const paymentChannel = await getPaymentVerificationChannel();
                const forceChannels = await getAllForceChannels();
                const requestChannel = await getWithdrawRequestChannel();
                const textOut = `📢 <b>CHANNEL SETTINGS</b>\n\n🔐 <b>Payment Channel:</b> <code>${escapeHtml(paymentChannel || 'Not Set')}</code>\n📢 <b>Force Channels:</b> <b>${Object.keys(forceChannels).length}</b>\n💸 <b>Request Channel:</b> <code>${escapeHtml(requestChannel || 'Not Set')}</code>`;
                const kb = [
                    [{ text: '🔐 Set Payment/Verification Channel', callback_data: 'payment_channel_set' }],
                    [{ text: '💸 Set Withdraw Request Channel', callback_data: 'withdraw_request_channel_set' }],
                    ...forceJoinKeyboard().inline_keyboard
                ];
                await sendMessage(chatId, textOut, { inline_keyboard: kb });
                return;
            }
            if (text === '🎁 বোনাস সেটিংস') {
                const welcome = Number(await getSetting('welcome_bonus', 0));
                const referral = Number(await getSetting('referral_bonus', 0));
                await sendMessage(chatId, `🎁 <b>বোনাস সেটিংস</b>\n\n🎁 Welcome: <b>${formatNumber(welcome)} ⭐</b>\n👥 Referral: <b>${formatNumber(referral)} ⭐</b>`, bonusKeyboard());
                return;
            }
            if (text === '🎁 Gift Code') {
                await sendMessage(chatId, "🎁 <b>Gift Code Management</b>", giftKeyboard());
                return;
            }
            if (text === '💸 Withdraw Settings') {
                const min = Number(await getSetting('min_withdraw', 15));
                const fee = Number(await getSetting('withdraw_fee_percent', 0));
                await sendMessage(chatId, `💸 <b>Withdraw Settings</b>\n\n💰 Fixed: <b>${formatNumber(min)} STAR</b>\n📊 Fee: <b>${formatNumber(fee)}%</b>`, withdrawSettingsKeyboard());
                return;
            }
            if (text === '👮 এডমিন ম্যানেজমেন্ট' && isSuperAdmin(fromId)) {
                await sendMessage(chatId, "👮 <b>এডমিন ম্যানেজমেন্ট</b>", adminManagementKeyboard());
                return;
            }
            if (text === '📢 ব্রডকাস্ট') {
                await setAdminState(fromId, 'broadcast');
                await sendMessage(chatId, "📢 <b>ব্রডকাস্ট মেসেজ পাঠান:</b>", getCancelKeyboard());
                return;
            }
            if (text === '🛡️ রিস্টার্ট অল ভেরিফিকেশন') {
                const users = await getAllUsers();
                let count = 0;
                for (const [uid, u] of Object.entries(users)) {
                    if (u && String(uid) !== String(SUPER_ADMIN_ID)) {
                        await updateUser(uid, { verification_status: 'pending_device_verification' });
                        try {
                            await sendDeviceVerificationPrompt(uid, uid, u.first_name);
                            count++;
                        } catch {}
                    }
                }
                await sendMessage(chatId, `🛡️ <b>${count} জন ইউজারের কাছে ডিভাইস ভেরিফিকেশন পাঠানো হয়েছে এবং মেনু লক করা হয়েছে।</b>`);
                return;
            }
        }
    }
}

/*
|--------------------------------------------------------------------------
| VERCEL SERVERLESS ROUTER
|--------------------------------------------------------------------------
*/
module.exports = async (req, res) => {
    // 1. Native Telegram Mini App HTML Page (GET)
    if (req.method === 'GET' && req.query.action === 'verify_flow') {
        const { uid, name, t, sig } = req.query;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).send(renderMiniAppPage(uid, name, t, sig));
    }

    // 2. Anti-Multi-Account Submission (POST from Webapp)
    if (req.method === 'POST' && req.body && req.body.hardware_id) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return await handleDeviceVerificationSubmit(req, res);
    }

    // 3. Telegram Bot Webhook Updates (POST from Telegram)
    if (req.method === 'POST') {
        try {
            const update = req.body || {};
            await handleUpdate(update);
        } catch (err) {
            console.error(err);
        }
        return res.status(200).send('OK');
    }

    return res.status(200).send('Bot is running on Vercel ⚡');
};
