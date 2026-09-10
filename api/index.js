/*
|--------------------------------------------------------------------------
| AURA STAR PAY BOT (PRODUCTION READY ⚡)
| - Super Admin: 8045367594
| - Force Join with 2-Column Grid & Single Fallback (👀 Check)
| - Manual Payouts Done Control from Admin Panel
| - Complete Media/Forward Broadcast with Delete Support
| - Channel Broadcast Support
| - Real-time System Status with Customizable Source & Payouts
| - 24/7 Express Server for Render.com
|--------------------------------------------------------------------------
*/

const express = require('express');

const BOT_TOKEN = '8809628706:AAFABbmhw3fPakfRLPBbmIQt77qsPlLR48A';
const BOT_USERNAME = 'AuraStarPayBot';
const APP_URL = 'https://star-pay-go71.onrender.com';
const SUPPORT_USERNAME = 'Sakib_Developer1';

const SUPER_ADMIN_ID = 8045367594;

/*
|--------------------------------------------------------------------------
| FIREBASE CONFIGURATION
|--------------------------------------------------------------------------
*/
const FIREBASE_URL = 'https://aura-star-pay-default-rtdb.firebaseio.com';
const FIREBASE_API_KEY = 'AIzaSyDq337oNcs6G7m3ahBnOhnHzgBhzr892GU';
const FIREBASE_AUTH_EMAIL = 'sakib301210@gmail.com';
const FIREBASE_AUTH_PASSWORD = '@mayabiri';

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
    
    // ফ্লোটিং পয়েন্ট বা ৩.৯৯৯৯ জাতীয় তারতম্য দূর করে পূর্ণ সংখ্যা করা
    if (Math.abs(num - Math.round(num)) < 0.005) {
        return Math.round(num).toString();
    }
    
    // দশমিক থাকলে অপ্রয়োজনীয় শূন্য কেটে সর্বোচ্চ ২ ঘর রাখা
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

async function answerCallback(callbackId, text = '', alert = false) {
    return await telegramApi('answerCallbackQuery', {
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
        [{ text: '📊 System Status' }]
    ];
    if (isAdm) keyboard.push([{ text: '🛠 Admin Panel' }]);
    return { keyboard: keyboard, resize_keyboard: true, is_persistent: true };
}

function getAdminMenu(superAdmin) {
    const keyboard = [
        [{ text: '⭐ সেট Payouts Done' }, { text: '👥 User & Balance Management' }],
        [{ text: '💸 Withdraw Settings' }, { text: '📢 Channel Settings' }],
        [{ text: '🎁 বোনাস সেটিংস' }, { text: '🔧 Source Settings' }],
        [{ text: '📢 ব্রডকাস্ট' }, { text: '📢 চ্যানেল ব্রডকাস্ট' }]
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
    const channels = Object.values(forceChannels);
    if (!channels.length) return true;

    for (const ch of channels) {
        if (ch && ch.channel_id) {
            const joined = await isJoinedChannel(ch.channel_id, userId);
            if (!joined) return false;
        }
    }
    return true;
}

/*
|--------------------------------------------------------------------------
| FORCE JOIN DISPLAY (2-ROW GRID + SINGLE ROW FOR ODD + CHECK BUTTON)
|--------------------------------------------------------------------------
*/
async function showForceJoin(chatId) {
    const forceChannels = await getAllForceChannels();
    const channelList = Object.values(forceChannels).filter(ch => ch && ch.channel_link);

    const inlineKeyboard = [];
    const total = channelList.length;

    // ২ কলামে বাটন সাজানো হবে
    for (let i = 0; i < total; i += 2) {
        if (i + 1 < total) {
            inlineKeyboard.push([
                { text: `▶️ ${channelList[i].channel_name || 'Subscribe'}`, url: channelList[i].channel_link },
                { text: `▶️ ${channelList[i + 1].channel_name || 'Subscribe'}`, url: channelList[i + 1].channel_link }
            ]);
        } else {
            // বেজোড় হলে শেষ চ্যানেলটি সিঙ্গেল ফুল লাইনে
            inlineKeyboard.push([
                { text: `📢 ${channelList[i].channel_name || 'Subscribe'}`, url: channelList[i].channel_link }
            ]);
        }
    }

    // নিচে ছবি অনুযায়ী '👀 Check' বাটন
    inlineKeyboard.push([
        { text: '👀 Check', callback_data: 'verify_join' }
    ]);

    const text =
        `🌸 <b>Welcome to ${escapeHtml(BOT_USERNAME)}</b>\n\n` +
        `📝 Finish all required tasks to move ahead\n` +
        `🔗 Join every channel and visit links\n\n` +
        `👉 Press <b>[Check]</b> to continue`;

    await sendMessage(chatId, text, { inline_keyboard: inlineKeyboard });
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

        // ভেরিফাই চেক হ্যান্ডলার (আইপি ছাড়া সরাসরি ভেরিফাই)
        if (data === 'verify_join') {
            const joinedAll = await isUserJoinedAllChannels(fromId);
            if (!joinedAll) {
                await answerCallback(callback.id, "❌ আপনি এখনো প্রয়োজনীয় সব চ্যানেলে জয়েন করেননি!", true);
                return;
            }

            let user = await getUser(fromId);
            const now = Math.floor(Date.now() / 1000);

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

            // রেফারেল বোনাস
            if (user.referred_by && !user.referral_rewarded) {
                const ref = await getUser(user.referred_by);
                if (ref) {
                    const refBonus = Number(await getSetting('referral_bonus', 0));
                    await updateUser(user.referred_by, {
                        balance: Number(ref.balance || 0) + refBonus,
                        total_referrals: Number(ref.total_referrals || 0) + 1
                    });
                    await updateUser(fromId, { referral_rewarded: true });
                    await sendMessage(user.referred_by, `🎉 <b>New Referral Joined!</b>\n━━━━━━━━━━━━━━━━━━\n\n⭐ Bonus: <b>+${formatNumber(refBonus)} STAR</b>\n👥 Total Referrals: <b>${Number(ref.total_referrals || 0) + 1}</b>`);
                }
            }

            await answerCallback(callback.id, "✅ চ্যানেল ভেরিফিকেশন সফল হয়েছে!", false);
            if (chatId && messageId) await deleteMessage(chatId, messageId);

            await sendMessage(fromId, `✅ <b>ভেরিফিকেশন সফল হয়েছে!</b>\n\nWelcome to ${escapeHtml(BOT_USERNAME)}! 🎉`, await getUserMenu(fromId));
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

        // উইথড্র এপ্রুভ / রিজেক্ট
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

        // ==========================================
        // 📢 ব্রডকাস্ট কনফার্মেশন ও ডিলিট হ্যান্ডলার
        // ==========================================
        if (await isAdmin(fromId)) {
            // ইউজার ব্রডকাস্ট Send
            if (data === 'confirm_broadcast_users') {
                const aState = await getAdminState(fromId);
                if (!aState || aState.action !== 'confirm_broadcast_users') {
                    await answerCallback(callback.id, 'Session Expired!', true);
                    return;
                }
                await answerCallback(callback.id, '🚀 ব্রডকাস্ট শুরু হচ্ছে...');
                await clearAdminState(fromId);
                if (chatId && messageId) await deleteMessage(chatId, messageId);

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
                        [{ text: '🗑️ Delete Broadcast', callback_data: `delete_bc_${bId}` }]
                    ]
                };

                await sendMessage(chatId, `📢 <b>ইউজার ব্রডকাস্ট সম্পন্ন!</b>\n\n✅ সফল: <b>${success}</b>\n❌ ব্যর্থ: <b>${failed}</b>\n\n<i>ভুল করে গেলে নিচের বাটন চেপে ডিলিট করতে পারবেন।</i>`, deleteKeyboard);
                return;
            }

            // চ্যানেল ব্রডকাস্ট Send
            if (data === 'confirm_broadcast_channels') {
                const aState = await getAdminState(fromId);
                if (!aState || aState.action !== 'confirm_broadcast_channels') {
                    await answerCallback(callback.id, 'Session Expired!', true);
                    return;
                }
                await answerCallback(callback.id, '🚀 চ্যানেল ব্রডকাস্ট শুরু হচ্ছে...');
                await clearAdminState(fromId);
                if (chatId && messageId) await deleteMessage(chatId, messageId);

                const channels = await getAllForceChannels();
                let success = 0, failed = 0;
                const sentRecords = {};

                for (const ch of Object.values(channels)) {
                    if (ch && ch.channel_id) {
                        try {
                            const res = await copyMessage(ch.channel_id, aState.from_chat_id, aState.message_id);
                            if (res && res.ok && res.result?.message_id) {
                                success++;
                                sentRecords[ch.channel_id] = res.result.message_id;
                            } else {
                                failed++;
                            }
                        } catch {
                            failed++;
                        }
                    }
                }

                const bId = `bc_ch_${Date.now()}`;
                await firebaseRequest(`broadcast_history/${bId}`, 'PUT', {
                    type: 'channels',
                    sent: sentRecords,
                    created_at: Math.floor(Date.now() / 1000)
                });

                const deleteKeyboard = {
                    inline_keyboard: [
                        [{ text: '🗑️ Delete Channel Broadcast', callback_data: `delete_bc_${bId}` }]
                    ]
                };

                await sendMessage(chatId, `📢 <b>চ্যানেল ব্রডকাস্ট সম্পন্ন!</b>\n\n✅ সফল চ্যানেল: <b>${success}</b>\n❌ ব্যর্থ: <b>${failed}</b>\n\n<i>ভুল করে গেলে নিচের বাটন চেপে ডিলিট করতে পারবেন।</i>`, deleteKeyboard);
                return;
            }

            // ব্রডকাস্ট বাতিল
            if (data === 'cancel_broadcast') {
                await clearAdminState(fromId);
                if (chatId && messageId) await deleteMessage(chatId, messageId);
                await answerCallback(callback.id, '❌ ব্রডকাস্ট বাতিল করা হয়েছে!');
                await sendMessage(chatId, "❌ ব্রডকাস্ট বাতিল করা হয়েছে।", getAdminMenu(isSuperAdmin(fromId)));
                return;
            }

            // ব্রডকাস্ট ডিলিট হ্যান্ডলার
            const delMatch = data.match(/^delete_bc_(bc_[A-Za-z0-9_]+)$/);
            if (delMatch) {
                const bId = delMatch[1];
                const bcData = await firebaseRequest(`broadcast_history/${bId}`);
                if (!bcData || !bcData.sent) {
                    await answerCallback(callback.id, '⚠️ ব্রডকাস্ট হিস্টোরি পাওয়া যায়নি বা ইতিমধ্যে ডিলিট করা হয়েছে!', true);
                    return;
                }
                await answerCallback(callback.id, '🗑️ মেসেজগুলো ডিলিট করা হচ্ছে...');

                let delCount = 0;
                for (const [targetChat, targetMsgId] of Object.entries(bcData.sent)) {
                    try {
                        const delRes = await deleteMessage(targetChat, targetMsgId);
                        if (delRes && delRes.ok) delCount++;
                    } catch {}
                }

                await firebaseRequest(`broadcast_history/${bId}`, 'DELETE');
                if (chatId && messageId) await deleteMessage(chatId, messageId);
                await sendMessage(chatId, `🗑️ <b>সফলভাবে ${delCount}টি প্রেরিত ব্রডকাস্ট মেসেজ মুছে ফেলা হয়েছে!</b>`, getAdminMenu(isSuperAdmin(fromId)));
                return;
            }

            // অন্যান্য এডমিন কলব্যাক
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
                let list = `👮 <b>এডমিন তালিকা</b>\n━━━━━━━━━━━━━━━━━━\n\n👑 <b>Super Admin</b>\n• <code>${SUPER_ADMIN_ID}</code>\n\n👮 <b>অন্যান্য Admin</b>\n`;
                let has = false;
                for (const [aId, a] of Object.entries(admins)) {
                    if (a && a.active) { has = true; list += `• <code>${escapeHtml(aId)}</code>\n`; }
                }
                if (!has) list += "কোনো অতিরিক্ত Admin নেই।";
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
        }
    }

    // ==========================================
    // MESSAGE HANDLERS (TEXT & ALL MEDIA TYPES)
    // ==========================================
    if (update.message) {
        const msg = update.message;
        const fromId = String(msg.from.id).trim();
        const chatId = String(msg.chat.id);
        const text = normalizeText(msg.text || '');
        const isAdm = await isAdmin(fromId);

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
            await sendMessage(chatId, "❌ অপারেশন বাতিল করা হয়েছে।", await getUserMenu(fromId));
            return;
        }

        // ফোস জয়েন চেক
        if (!isAdm) {
            const joinedAll = await isUserJoinedAllChannels(fromId);
            if (!joinedAll) {
                await showForceJoin(chatId);
                return;
            }
        }

        // ==========================================
        // ADMIN STATES FOR ALL BROADCASTS & SETTINGS
        // ==========================================
        if (isAdm) {
            const aState = await getAdminState(fromId);

            // ১. ইউজার ব্রডকাস্ট ইনপুট (যেকোনো মিডিয়া / ফরওয়ার্ড)
            if (aState && aState.action === 'awaiting_broadcast_message') {
                await setAdminState(fromId, 'confirm_broadcast_users', {
                    from_chat_id: chatId,
                    message_id: msg.message_id
                });

                await copyMessage(chatId, chatId, msg.message_id);

                const confirmKb = {
                    inline_keyboard: [
                        [
                            { text: '✅ Done (Send to Users)', callback_data: 'confirm_broadcast_users' },
                            { text: '❌ Cancel', callback_data: 'cancel_broadcast' }
                        ]
                    ]
                };

                await sendMessage(chatId, "👆 <b>উপরের মেসেজটি প্রিভিউ হিসেবে দেখুন।</b>\n\nআপনি কি এই মেসেজটি <b>সকল ইউজারের কাছে</b> পাঠাতে চান?", confirmKb);
                return;
            }

            // ২. চ্যানেল ব্রডকাস্ট ইনপুট (যেকোনো মিডিয়া / ফরওয়ার্ড)
            if (aState && aState.action === 'awaiting_channel_broadcast_message') {
                await setAdminState(fromId, 'confirm_broadcast_channels', {
                    from_chat_id: chatId,
                    message_id: msg.message_id
                });

                await copyMessage(chatId, chatId, msg.message_id);

                const confirmKb = {
                    inline_keyboard: [
                        [
                            { text: '✅ Done (Send to Channels)', callback_data: 'confirm_broadcast_channels' },
                            { text: '❌ Cancel', callback_data: 'cancel_broadcast' }
                        ]
                    ]
                };

                await sendMessage(chatId, "👆 <b>উপরের মেসেজটি প্রিভিউ হিসেবে দেখুন।</b>\n\nআপনি কি এই মেসেজটি <b>সকল চ্যানেলে</b> পাঠাতে চান?", confirmKb);
                return;
            }

            // টেক্সট স্টেট হ্যান্ডলার
            if (aState && aState.action && text) {
                const action = aState.action;

                // ম্যানুয়াল Payouts Done সেট করার স্টেট
                if (action === 'set_payouts_done') {
                    if (isNumericAmount(text) && Number(text) >= 0) {
                        const formatted = formatNumber(Number(text));
                        await setSetting('custom_payouts_done', formatted);
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>Payouts Done সফলভাবে সেট করা হয়েছে:</b> <b>${formatted} Star</b>`, getAdminMenu(isSuperAdmin(fromId)));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক সংখ্যা পাঠান (যেমন: 500 বা 1000):", getCancelKeyboard());
                    }
                    return;
                }

                if (action === 'set_source_info') {
                    const parts = text.split('|').map(s => s.trim());
                    const sName = parts[0] || 'RJ Maker Pro';
                    const sLink = parts[1] || '';

                    await setSetting('source_name', sName);
                    await setSetting('source_link', sLink);
                    await clearAdminState(fromId);
                    await sendMessage(chatId, `✅ <b>Source Updated Successfully!</b>\n\n🔧 Name: <b>${escapeHtml(sName)}</b>\n🔗 Link: <code>${escapeHtml(sLink || 'None')}</code>`, getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (action === 'minimum_withdraw') {
                    if (isNumericAmount(text) && Number(text) > 0) {
                        await setSetting('min_withdraw', Number(text));
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>Fixed Withdraw Amount Updated: ${formatNumber(Number(text))} ⭐</b>`, getAdminMenu(isSuperAdmin(fromId)));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক সংখ্যা লিখুন (যেমন: 15):", getCancelKeyboard());
                    }
                    return;
                }

                if (action === 'withdraw_fee') {
                    if (isNumericAmount(text) && Number(text) >= 0 && Number(text) <= 100) {
                        await setSetting('withdraw_fee_percent', Number(text));
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>Withdrawal Fee Updated: ${formatNumber(Number(text))}%</b>`, getAdminMenu(isSuperAdmin(fromId)));
                    } else {
                        await sendMessage(chatId, "❌ 0 থেকে 100 এর মধ্যে সংখ্যা লিখুন:", getCancelKeyboard());
                    }
                    return;
                }

                if (action === 'welcome_bonus') {
                    if (isNumericAmount(text) && Number(text) >= 0) {
                        await setSetting('welcome_bonus', Number(text));
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>Welcome Bonus Updated: ${formatNumber(Number(text))} ⭐</b>`, getAdminMenu(isSuperAdmin(fromId)));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক সংখ্যা লিখুন:", getCancelKeyboard());
                    }
                    return;
                }

                if (action === 'referral_bonus') {
                    if (isNumericAmount(text) && Number(text) >= 0) {
                        await setSetting('referral_bonus', Number(text));
                        await clearAdminState(fromId);
                        await sendMessage(chatId, `✅ <b>Referral Bonus Updated: ${formatNumber(Number(text))} ⭐</b>`, getAdminMenu(isSuperAdmin(fromId)));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক সংখ্যা লিখুন:", getCancelKeyboard());
                    }
                    return;
                }

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
                    if (/^\d+$/.test(text) && !isSuperAdmin(text)) {
                        await firebaseRequest(`admins/${text}`, 'DELETE');
                        await clearAdminState(fromId);
                        await sendMessage(chatId, "✅ <b>Admin Removed Successfully!</b>", getAdminMenu(true));
                    } else {
                        await sendMessage(chatId, "❌ সঠিক ID পাঠান (Super Admin রিমুভ করা যাবে না):", getCancelKeyboard());
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
                    await sendMessage(chatId, "🔘 <b>Button Name দিন (যেমন: Subscribe):</b>", getCancelKeyboard());
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
            }
        }

        // ==========================================
        // USER STATE: WITHDRAWAL PROCESSING
        // ==========================================
        if (!isAdm) {
            const uState = await getUserState(fromId);
            if (uState && uState.action === 'withdraw_username' && text) {
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

                const fee = Number(await getSetting('withdraw_fee_percent', 0));
                const afterFee = Math.max(0, fixedAmount - (fixedAmount * fee / 100));
                const txId = `${fromId}${Math.floor(Date.now() / 1000)}`;

                const reqChannel = await getWithdrawRequestChannel();
                if (!reqChannel) {
                    await sendMessage(chatId, "⚠️ Withdraw Request Channel Configured নেই।");
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

                    const withdrawConfirmText =
                        `🔔 <b>Withdrawal Submitted!</b>\n━━━━━━━━━━━━━━━━━━\n\n` +
                        `💰 Amount: <b>${formatNumber(fixedAmount)} STAR</b>\n` +
                        `📊 Fee: <b>${formatNumber(fee)}%</b>\n` +
                        `💵 After Fee: <b>${formatNumber(afterFee)} STAR</b>\n` +
                        `📬 To: <b>${escapeHtml(target)}</b>\n` +
                        `🧾 ID: <code>${txId}</code>\n` +
                        `📌 Status: <b>PENDING ⏳</b>`;

                    await sendMessage(chatId, withdrawConfirmText, await getUserMenu(fromId));
                }
                return;
            }
        }

        // ==========================================
        // COMMANDS & USER MENUS
        // ==========================================
        if (text.startsWith('/start')) {
            const politeStartText = `🌟 <b>Welcome, ${escapeHtml(msg.from.first_name || 'User')}!</b>\n\nEarn Telegram Stars easily and withdraw directly.`;
            await sendMessage(chatId, politeStartText, await getUserMenu(fromId));
            return;
        }

        if (text === '🛠 Admin Panel') {
            if (!isAdm) {
                await sendMessage(chatId, "⛔ <b>Access Denied!</b>", await getUserMenu(fromId));
                return;
            }
            await clearAdminState(fromId);
            await sendMessage(chatId, "🛠 <b>Admin Panel Activated</b>", getAdminMenu(isSuperAdmin(fromId)));
            return;
        }

        if (text === '🔙 ইউজার প্যানেলে ফিরে যান') {
            await clearAdminState(fromId);
            await clearUserState(fromId);
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
                `👋 <b>Welcome, ${escapeHtml(msg.from.first_name || 'User')}!</b>\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🎁 <b>Referral Center</b>\n\n` +
                `👥 <b>Total Referrals :</b> <b>${refCount}</b>\n` +
                `💰 <b>Reward Per Referral :</b> <b>${formatNumber(refBonus)} ⭐</b>\n\n` +
                `🔗 <b>Your Referral Link:</b>\n<code>${link}</code>`;

            await sendMessage(chatId, refMessage, {
                inline_keyboard: [
                    [{ text: '🚀 Share', url: shareUrl }, { text: '🏆 Leaderboard', callback_data: 'leaderboard' }]
                ]
            });
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
            const withdrawPrompt = `💸 <b>WITHDRAW STARS</b>\n━━━━━━━━━━━━━━━━━━\n\n💰 Fixed Amount: <b>${formatNumber(fixedAmount)} STAR</b>\n\n📢 চ্যানেলের Username বা Post Link দিন\nExample: <code>@channelname / https://t.me/channel/123</code>`;
            await sendMessage(chatId, withdrawPrompt, getCancelKeyboard());
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

        // 📊 SYSTEM STATUS HANDLER (এডমিনের সেট করা Payouts Done সরাসরি প্রদর্শন করবে)
        if (text === '📊 System Status') {
            const users = await getAllUsers();
            const totalUsersCount = Object.keys(users).length;

            const customPayouts = await getSetting('custom_payouts_done', '0');

            const sourceName = (await getSetting('source_name', 'RJ Maker Pro')) || 'RJ Maker Pro';
            const sourceLink = (await getSetting('source_link', '')) || '';

            let sourceDisplay = escapeHtml(sourceName);
            if (sourceLink) {
                sourceDisplay = `<a href="${escapeHtml(sourceLink)}">${escapeHtml(sourceName)}</a>`;
            }

            const statusMessage =
                `📡 <b>SYSTEM STATUS</b>\n\n` +
                `👥 <b>Users Count:</b> ${totalUsersCount} Users\n\n` +
                `⭐ <b>Payouts Done:</b> ${escapeHtml(customPayouts)} Star\n\n` +
                `🔧 <b>Source:</b> ${sourceDisplay}`;

            await sendMessage(chatId, statusMessage);
            return;
        }

        // ==========================================
        // ADMIN PANEL BUTTONS
        // ==========================================
        if (isAdm) {
            // ১. এডমিন Payouts Done সেট করার বাটন
            if (text === '⭐ সেট Payouts Done') {
                await setAdminState(fromId, 'set_payouts_done');
                const cur = await getSetting('custom_payouts_done', '0');
                const prompt =
                    `⭐ <b>Payouts Done সেটিংস</b>\n\n` +
                    `বর্তমান Payouts Done: <b>${escapeHtml(cur)} Star</b>\n\n` +
                    `নতুন কত স্টার দেখাতে চান তা লিখে পাঠান (যেমন: <code>500</code> বা <code>1000</code>):`;
                await sendMessage(chatId, prompt, getCancelKeyboard());
                return;
            }

            if (text === '👥 User & Balance Management') {
                await sendMessage(chatId, "👥 <b>User & Balance Management</b>", balanceKeyboard());
                return;
            }

            if (text === '📢 Channel Settings') {
                const forceChannels = await getAllForceChannels();
                const requestChannel = await getWithdrawRequestChannel();
                const textOut = `📢 <b>CHANNEL SETTINGS</b>\n\n📢 <b>Force Channels:</b> <b>${Object.keys(forceChannels).length}</b>\n💸 <b>Request Channel:</b> <code>${escapeHtml(requestChannel || 'Not Set')}</code>`;
                const kb = [
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

            if (text === '💸 Withdraw Settings') {
                const min = Number(await getSetting('min_withdraw', 15));
                const fee = Number(await getSetting('withdraw_fee_percent', 0));
                await sendMessage(chatId, `💸 <b>Withdraw Settings</b>\n\n💰 Fixed: <b>${formatNumber(min)} STAR</b>\n📊 Fee: <b>${formatNumber(fee)}%</b>`, withdrawSettingsKeyboard());
                return;
            }

            if (text === '🔧 Source Settings') {
                await setAdminState(fromId, 'set_source_info');
                const curName = await getSetting('source_name', 'RJ Maker Pro');
                const curLink = await getSetting('source_link', '');
                const prompt = 
                    `🔧 <b>Source Name & Link Settings</b>\n\n` +
                    `বর্তমান Source: <b>${escapeHtml(curName)}</b>\n` +
                    `বর্তমান Link: <code>${escapeHtml(curLink || 'None')}</code>\n\n` +
                    `নতুন Source নাম এবং লিংক পাঠান নিচের ফরম্যাটে:\n` +
                    `<code>NAME | LINK</code>\n\n` +
                    `উদাহরণ:\n<code>RJ Maker Pro | https://t.me/rjmakerpro</code>`;
                await sendMessage(chatId, prompt, getCancelKeyboard());
                return;
            }

            // ইউজার ব্রডকাস্ট
            if (text === '📢 ব্রডকাস্ট') {
                await setAdminState(fromId, 'awaiting_broadcast_message');
                const prompt =
                    `📢 <b>ইউজার ব্রডকাস্ট মোড অন করা হয়েছে</b>\n\n` +
                    `আপনি যা ব্রডকাস্ট করতে চান তা পাঠান:\n` +
                    `• যেকোনো টেক্সট\n` +
                    `• ছবি (Photo)\n` +
                    `• ভিডিও (Video)\n` +
                    `• ফাইল বা ডকুমেন্ট (Document/File)\n` +
                    `• কোনো চ্যানেল বা গ্রুপ থেকে ফরওয়ার্ড করা মেসেজ\n\n` +
                    `মেসেজ পাঠানোর পর আপনাকে প্রিভিউ সহ <b>Done</b> এবং <b>Cancel</b> অপশন দেওয়া হবে।`;
                await sendMessage(chatId, prompt, getCancelKeyboard());
                return;
            }

            // চ্যানেল ব্রডকাস্ট
            if (text === '📢 চ্যানেল ব্রডকাস্ট') {
                await setAdminState(fromId, 'awaiting_channel_broadcast_message');
                const prompt =
                    `📢 <b>চ্যানেল ব্রডকাস্ট মোড অন করা হয়েছে</b>\n\n` +
                    `বট যেসকল ফোর্স চ্যানেলে এডমিন রয়েছে, সেগুলোতে পাঠানোর জন্য মেসেজ পাঠান:\n` +
                    `• যেকোনো টেক্সট / ছবি / ভিডিও / ফাইল / ফরওয়ার্ড মেসেজ\n\n` +
                    `মেসেজ পাঠানোর পর প্রিভিউ সহ <b>Done</b> এবং <b>Cancel</b> অপশন পাবেন।`;
                await sendMessage(chatId, prompt, getCancelKeyboard());
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
| 24/7 EXPRESS SERVER SETUP
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
        console.error(err);
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
        console.log('Auto Webhook Status:', res);
    } catch (err) {
        console.error('Webhook Setup Error:', err);
    }
});
