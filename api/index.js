/*
|--------------------------------------------------------------------------
| STAR EARNING BOT FOR VERCEL (PREMIUM UI & FIXED WITHDRAWAL)
|--------------------------------------------------------------------------
*/

const BOT_TOKEN = '8852283670:AAFnBJlS7mnNh6NIglslOGzNFj8OEZoMEB0';
const BOT_USERNAME = 'AS_Star_Eran_Bot';

const SUPER_ADMIN_ID = 8045367594;

const FIREBASE_URL = 'https://star-fe264-default-rtdb.firebaseio.com';
const FIREBASE_API_KEY = 'AIzaSyBfyhT9DHKYv5m6UtTnZF_lX0URts2Y9PM';

const FIREBASE_AUTH_EMAIL = 'sakib301210@gmail.com';
const FIREBASE_AUTH_PASSWORD = '@mayabiri';
const FIREBASE_AUTH_UID = 'WUVFzcS2jvXDXgGfUAQPl9ESl943';

/*
|--------------------------------------------------------------------------
| HELPERS
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

/*
|--------------------------------------------------------------------------
| FIREBASE AUTH & REQUESTS
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
        if (!data || !data.idToken || String(data.localId) !== String(FIREBASE_AUTH_UID)) return null;

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
| FIREBASE DATA METHODS
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

async function getUserWithdrawalCount(userId) {
    const all = await firebaseRequest('withdrawals');
    if (!all || typeof all !== 'object') return 0;
    let count = 0;
    for (const item of Object.values(all)) {
        if (item && String(item.user_id) === String(userId)) count++;
    }
    return count;
}

/*
|--------------------------------------------------------------------------
| TELEGRAM API
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
        [{ text: '📢 ব্রডকাস্ট' }]
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
    return {
        inline_keyboard: [
            [
                { text: '✅ Approve', callback_data: `withdraw_approve_${withdrawId}` },
                { text: '❌ Reject', callback_data: `withdraw_reject_${withdrawId}` }
            ]
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
| FORCE JOIN MESSAGE (আগের মতো ১ কলামে সবুজ আইকনযুক্ত বাটন)
|--------------------------------------------------------------------------
*/
async function showForceJoin(chatId) {
    const forceChannels = await getAllForceChannels();
    const keyboard = [];

    for (const ch of Object.values(forceChannels)) {
        if (ch && ch.channel_link) {
            keyboard.push([{
                text: `🟢 ${ch.channel_name || 'JOIN CHANNEL'} ↗`,
                url: ch.channel_link
            }]);
        }
    }

    const paymentChannel = await getPaymentVerificationChannel();
    if (paymentChannel) {
        const link = paymentChannel.startsWith('@') ? `https://t.me/${paymentChannel.slice(1)}` : '';
        if (link) {
            keyboard.push([{
                text: '🟢 PAYOUT CHANNEL ↗',
                url: link
            }]);
        }
    }

    keyboard.push([{ text: '✅ Verify Joining', callback_data: 'verify_join' }]);

    const text = 
        `🔐 <b>Verification Required</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `বট ব্যবহার করার আগে নিচের সকল চ্যানেলে যুক্ত (Join) হতে হবে।\n\n` +
        `সবগুলোতে Join করার পর নিচে থাকা <b>✅ Verify Joining</b> বাটনে চাপুন।`;

    await sendMessage(chatId, text, { inline_keyboard: keyboard });
}

function buildWithdrawRequestText(withdraw, status = 'pending', processedBy = '') {
    const amount = Number(withdraw.amount || 0);
    const fee = Number(withdraw.fee_percent || 0);
    const afterFee = Number(withdraw.after_fee || amount);
    const userId = String(withdraw.user_id || '');
    const firstName = String(withdraw.first_name || 'User');
    const withdrawUsername = String(withdraw.withdraw_username || 'N/A');
    const transactionId = String(withdraw.transaction_id || '');
    const createdAt = Number(withdraw.created_at || Math.floor(Date.now() / 1000));

    const statusUpper = status.toUpperCase();
    const statusEmoji = { 'APPROVED': '✅', 'REJECTED': '❌', 'FAILED': '⚠️' }[statusUpper] || '⏳';
    const title = statusUpper === 'PENDING' ? '💸 <b>NEW WITHDRAW REQUEST</b>' : `${statusEmoji} <b>WITHDRAW REQUEST ${statusUpper}</b>`;

    let text = `${title}\n━━━━━━━━━━━━━━━━━━\n` +
        `👤 Name: <b>${escapeHtml(firstName)}</b>\n` +
        `🆔 Telegram ID: <code>${escapeHtml(userId)}</code>\n\n` +
        `💰 Amount: <b>${formatNumber(amount)} STAR</b>\n` +
        `📱 Payment Username: <b>${escapeHtml(withdrawUsername)}</b>\n` +
        `📊 Fee: <b>${formatNumber(fee)}%</b>\n` +
        `💵 After Fee: <b>${formatNumber(afterFee)} STAR</b>\n\n` +
        `🧾 Transaction ID: <code>${escapeHtml(transactionId)}</code>\n` +
        `📅 Date: <b>${formatDate(createdAt)}</b>\n` +
        `⏰ Time: <b>${formatTime(createdAt)}</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📌 Status: <b>${statusUpper} ${statusEmoji}</b>`;

    if (processedBy) text += `\n👮 Processed By: <b>${escapeHtml(processedBy)}</b>`;
    return text;
}

/*
|--------------------------------------------------------------------------
| MAIN LOGIC HANDLER
|--------------------------------------------------------------------------
*/
async function handleUpdate(update) {
    if (update.callback_query) {
        const callback = update.callback_query;
        const fromId = String(callback.from.id);
        const data = callback.data || '';
        const chatId = callback.message?.chat?.id;
        const messageId = callback.message?.message_id;

        // VERIFY JOINING (২টি আলাদা মেসেজ পাঠানো)
        if (data === 'verify_join') {
            const user = await getUser(fromId);
            const joinedAll = await isUserJoinedAllChannels(fromId);
            if (!joinedAll) {
                await answerCallback(callback.id, '❌ আপনি এখনো সব Required Channel-এ Join করেননি!', true);
                return;
            }

            if (user && !user.is_verified) {
                const welcomeBonus = Number(await getSetting('welcome_bonus', 0));
                await updateUser(fromId, {
                    is_verified: true,
                    balance: Number(user.balance || 0) + welcomeBonus,
                    welcome_claimed: true,
                    verified_at: Math.floor(Date.now() / 1000)
                });

                if (user.referred_by && !user.referral_rewarded) {
                    const ref = await getUser(user.referred_by);
                    if (ref) {
                        const refBonus = Number(await getSetting('referral_bonus', 0));
                        await updateUser(user.referred_by, {
                            balance: Number(ref.balance || 0) + refBonus,
                            total_referrals: Number(ref.total_referrals || 0) + 1
                        });
                        await updateUser(fromId, { referral_rewarded: true });
                        await sendMessage(user.referred_by, `🎉 <b>New Referral Verified!</b>\n━━━━━━━━━━━━━━━━━━\n\nআপনার রেফারেল লিংক দিয়ে যুক্ত হওয়া একজন নতুন ইউজার ভেরিফিকেশন সম্পন্ন করেছে!\n\n⭐ Bonus: <b>+${formatNumber(refBonus)} STAR</b>\n👥 Total Referrals: <b>${Number(ref.total_referrals || 0) + 1}</b>`);
                    }
                }
            }

            await answerCallback(callback.id, '🎉 Verification Successful!');
            
            // মেসেজ ১: স্বাগতম বার্তা
            const name = escapeHtml(callback.from.first_name || 'ইউজার');
            const politeWelcomeText = 
                `✨ <b>স্বাগতম, ${name}!</b> ✨\n` +
                `━━━━━━━━━━━━━━━━━━\n\n` +
                `🎉 <b>আপনার ভেরিফিকেশন সফলভাবে সম্পন্ন হয়েছে!</b>\n\n` +
                `আমাদের <b>Star Earning Bot</b>-এ আপনাকে আন্তরিক স্বাগতম। এখন থেকে আপনি বটের সকল সুবিধা উপভোগ করতে পারবেন এবং বন্ধুদের রেফার করে সহজেই STAR পয়েন্ট উপার্জন করতে পারবেন। ⭐`;
            await sendMessage(fromId, politeWelcomeText);

            // মেসেজ ২: মেইন মেনু মেসেজ ও বাটন
            const mainMenuPrompt = 
                `🏠 <b>Main Menu</b>\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `🌟 <i>যেকোনো সুবিধা পেতে নিচের মেনু অপশনগুলো ব্যবহার করুন। আপনার পথচলা সুন্দর ও আনন্দদায়ক হোক!</i>`;
            await sendMessage(fromId, mainMenuPrompt, await getUserMenu(fromId));
            return;
        }

        // LEADERBOARD CALLBACK
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
                    await sendReplyMessage(chatId, messageId, buildWithdrawRequestText(withdraw, 'approved', adminUsername));
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
                    await sendReplyMessage(chatId, messageId, buildWithdrawRequestText(withdraw, 'rejected', adminUsername));
                }
                return;
            }
        }

        // ADMIN CALLBACK ACTIONS
        if (await isAdmin(fromId)) {
            if (data === 'admin_add' && isSuperAdmin(fromId)) {
                await setAdminState(fromId, 'add_admin');
                await answerCallback(callback.id, 'Admin ID পাঠান');
                await sendMessage(fromId, "➕ <b>নতুন এডমিন যোগ করুন</b>\n━━━━━━━━━━━━━━━━━━\n\nযে Telegram User ID-কে Admin করতে চান সেটি পাঠান:", getCancelKeyboard());
                return;
            }
            if (data === 'admin_remove' && isSuperAdmin(fromId)) {
                await setAdminState(fromId, 'remove_admin');
                await answerCallback(callback.id, 'Admin ID পাঠান');
                await sendMessage(fromId, "➖ <b>এডমিন রিমুভ করুন</b>\n━━━━━━━━━━━━━━━━━━\n\nযে Admin-কে Remove করতে চান তার Telegram ID পাঠান:", getCancelKeyboard());
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
                await sendMessage(fromId, "➕ <b>ফোর্স জয়েন চ্যানেল যোগ করুন</b>\n━━━━━━━━━━━━━━━━━━\n\nপ্রথমে Channel / Group ID পাঠান।\n\n<b>উদাহরণ:</b>\n<code>-1001234567890</code>\n\n⚠️ নিশ্চিত করুন Bot ওই Channel/Group-এ Admin আছে।", getCancelKeyboard());
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
                await sendMessage(fromId, "📢 <b>ফোর্স জয়েন চ্যানেল রিমুভ</b>\n\nনিচের তালিকা থেকে Channel নির্বাচন করুন:", { inline_keyboard: kb });
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
                let list = "📢 <b>ফোর্স জয়েন চ্যানেল তালিকা</b>\n━━━━━━━━━━━━━━━━━━\n";
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
            
            // ব্যালেন্স অ্যাড: ধাপ ১
            if (data === 'balance_add') {
                await setAdminState(fromId, 'add_balance_user');
                await answerCallback(callback.id, 'User ID পাঠান');
                await sendMessage(fromId, "➕ <b>ব্যালেন্স যোগ করুন (ধাপ ১/২)</b>\n━━━━━━━━━━━━━━━━━━\n\n👤 যে ইউজারের ব্যালেন্স যোগ করতে চান, তার <b>Telegram User ID</b> পাঠান:", getCancelKeyboard());
                return;
            }
            
            // ব্যালেন্স কাট: ধাপ ১
            if (data === 'balance_cut') {
                await setAdminState(fromId, 'cut_balance_user');
                await answerCallback(callback.id, 'User ID পাঠান');
                await sendMessage(fromId, "➖ <b>ব্যালেন্স কাটুন (ধাপ ১/২)</b>\n━━━━━━━━━━━━━━━━━━\n\n👤 যে ইউজারের ব্যালেন্স কাটতে চান, তার <b>Telegram User ID</b> পাঠান:", getCancelKeyboard());
                return;
            }

            if (data === 'bonus_welcome') {
                await setAdminState(fromId, 'welcome_bonus');
                await answerCallback(callback.id, 'Send amount');
                const cur = Number(await getSetting('welcome_bonus', 0));
                await sendMessage(fromId, `🎁 <b>ওয়েলকাম বোনাস সেট করুন</b>\n\nবর্তমান Bonus: <b>${formatNumber(cur)} ⭐</b>\n\nনতুন Amount পাঠান:`, getCancelKeyboard());
                return;
            }
            if (data === 'bonus_referral') {
                await setAdminState(fromId, 'referral_bonus');
                await answerCallback(callback.id, 'Send amount');
                const cur = Number(await getSetting('referral_bonus', 0));
                await sendMessage(fromId, `👥 <b>রেফারেল বোনাস সেট করুন</b>\n\nবর্তমান Bonus: <b>${formatNumber(cur)} ⭐</b>\n\nনতুন Amount পাঠান:`, getCancelKeyboard());
                return;
            }
            if (data === 'withdraw_minimum') {
                await setAdminState(fromId, 'minimum_withdraw');
                await answerCallback(callback.id, 'Send amount');
                const cur = Number(await getSetting('min_withdraw', 15));
                await sendMessage(fromId, `💸 <b>ফিক্সড উইথড্র অ্যামাউন্ট সেট করুন</b>\n━━━━━━━━━━━━━━━━━━\n\nবর্তমান ফিক্সড উইথড্র: <b>${formatNumber(cur)} ⭐</b>\n\nনতুন Amount পাঠান (ইউজার ঠিক এই পরিমাণ উইথড্র করতে পারবে):`, getCancelKeyboard());
                return;
            }
            if (data === 'withdraw_fee') {
                await setAdminState(fromId, 'withdraw_fee');
                await answerCallback(callback.id, 'Send fee');
                const cur = Number(await getSetting('withdraw_fee_percent', 0));
                await sendMessage(fromId, `📊 <b>উইথড্র ফি সেট করুন</b>\n\nবর্তমান Fee: <b>${formatNumber(cur)}%</b>\n\n0 থেকে 100 এর মধ্যে Percentage পাঠান:`, getCancelKeyboard());
                return;
            }
            if (data === 'payment_channel_set') {
                await setAdminState(fromId, 'payment_verification_channel');
                await answerCallback(callback.id, 'Send channel');
                const current = await getPaymentVerificationChannel();
                await sendMessage(fromId, `📢 <b>Payment/Verification Channel</b>\n━━━━━━━━━━━━━━━━━━\n\nFormat:\n<code>@channelusername</code>\nঅথবা\n<code>-1001234567890</code>\n\nবর্তমান:\n<b>${current !== '' ? escapeHtml(current) : 'Not Set'}</b>`, getCancelKeyboard());
                return;
            }
            if (data === 'withdraw_request_channel_set') {
                await setAdminState(fromId, 'withdraw_request_channel');
                await answerCallback(callback.id, 'Send channel');
                const current = await getWithdrawRequestChannel();
                await sendMessage(fromId, `💸 <b>Withdraw Request Channel</b>\n━━━━━━━━━━━━━━━━━━\n\nFormat:\n<code>@channelusername</code>\nঅথবা\n<code>-1001234567890</code>\n\nবর্তমান:\n<b>${current !== '' ? escapeHtml(current) : 'Not Set'}</b>`, getCancelKeyboard());
                return;
            }
            if (data === 'gift_create') {
                await setAdminState(fromId, 'gift_code');
                await answerCallback(callback.id, 'Send details');
                await sendMessage(fromId, "🎁 <b>নতুন Gift Code তৈরি করুন</b>\n\nFormat:\n<code>CODE | STAR_AMOUNT | MAX_USERS</code>\n\nExample:\n<code>WELCOME50 | 5 | 100</code>", getCancelKeyboard());
                return;
            }
            if (data === 'gift_list') {
                const codes = (await firebaseRequest('gift_codes')) || {};
                let out = "🎁 <b>Gift Code তালিকা</b>\n━━━━━━━━━━━━━━━━━━";
                if (!Object.keys(codes).length) out += "\n\nকোনো Gift Code নেই।";
                else {
                    for (const [code, gift] of Object.entries(codes)) {
                        if (gift) out += `\n\n🎁 <code>${escapeHtml(code)}</code>\n⭐ Reward: <b>${formatNumber(Number(gift.amount || 0))} STAR</b>\n👥 Used: <b>${gift.used_count || 0} / ${gift.max_users || 0}</b>`;
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
        const isAdm = await isAdmin(fromId);

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
                balance: 0,
                referred_by: refBy,
                is_verified: false,
                created_at: Math.floor(Date.now() / 1000)
            };
            await setUser(fromId, user);
        }

        // GLOBAL CANCEL
        if (text.toLowerCase() === '/cancel') {
            await clearAdminState(fromId);
            await clearUserState(fromId);
            await updateUser(fromId, { withdraw_state: null });
            await sendMessage(chatId, "❌ অপারেশন বাতিল করা হয়েছে।", isAdm ? getAdminMenu(isSuperAdmin(fromId)) : await getUserMenu(fromId));
            return;
        }

        // ADMIN STATE INPUTS
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
                        await sendMessage(chatId, "❌ সঠিক Numeric Telegram ID পাঠান:", getCancelKeyboard());
                    }
                    return;
                }

                if (action === 'remove_admin') {
                    if (/^\d+$/.test(text) && text !== String(SUPER_ADMIN_ID)) {
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
                        await sendMessage(chatId, "🔗 <b>এখন Channel Link অথবা Username দিন:</b>\n\nউদাহরণ: <code>https://t.me/example</code>", getCancelKeyboard());
                    } else {
                        await sendMessage(chatId, "❌ সঠিক Channel ID দিন (যেমন: <code>-1001234567890</code>):", getCancelKeyboard());
                    }
                    return;
                }

                if (action === 'add_force_channel_link') {
                    let link = text.trim();
                    if (link.startsWith('@')) link = 'https://t.me/' + link.slice(1);
                    await setAdminState(fromId, 'add_force_channel_name', { channel_id: aState.channel_id, channel_link: link });
                    await sendMessage(chatId, "🔘 <b>এখন Button Name দিন:</b>", getCancelKeyboard());
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
                    await sendMessage(chatId, "🎉 <b>Force Join Channel Added Successfully!</b>", getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                // ব্যালেন্স অ্যাড: ধাপ ১
                if (action === 'add_balance_user') {
                    if (!/^\d+$/.test(text)) {
                        await sendMessage(chatId, "❌ <b>সঠিক Numeric Telegram User ID পাঠান:</b>", getCancelKeyboard());
                        return;
                    }
                    const targetUser = await getUser(text);
                    if (!targetUser) {
                        await sendMessage(chatId, "❌ <b>ইউজার পাওয়া যায়নি!</b>\n\nদয়া করে সঠিক User ID পাঠান:", getCancelKeyboard());
                        return;
                    }
                    await setAdminState(fromId, 'add_balance_amount', {
                        target_id: text,
                        target_name: targetUser.first_name || 'User',
                        current_bal: Number(targetUser.balance || 0)
                    });
                    await sendMessage(chatId, 
                        `👤 <b>ইউজার পাওয়া গেছে!</b>\n━━━━━━━━━━━━━━━━━━\n` +
                        `• নাম: <b>${escapeHtml(targetUser.first_name || 'User')}</b>\n` +
                        `• আইডি: <code>${text}</code>\n` +
                        `• বর্তমান ব্যালেন্স: <b>${formatNumber(Number(targetUser.balance || 0))} ⭐</b>\n\n` +
                        `💰 <b>(ধাপ ২/২) কত STAR যোগ করতে চান সেই Amount লিখুন:</b>`, 
                        getCancelKeyboard()
                    );
                    return;
                }

                // ব্যালেন্স অ্যাড: ধাপ ২
                if (action === 'add_balance_amount') {
                    if (!isNumericAmount(text) || Number(text) <= 0) {
                        await sendMessage(chatId, "❌ <b>সঠিক Amount লিখুন (০ এর বেশি হতে হবে):</b>", getCancelKeyboard());
                        return;
                    }
                    const amt = Number(text);
                    const targetId = aState.target_id;
                    const targetUser = await getUser(targetId);
                    if (targetUser) {
                        const newBal = Number(targetUser.balance || 0) + amt;
                        await updateUser(targetId, { balance: newBal });
                        await clearAdminState(fromId);
                        await sendMessage(chatId, 
                            `✅ <b>ব্যালেন্স সফলভাবে যোগ করা হয়েছে!</b>\n━━━━━━━━━━━━━━━━━━\n` +
                            `👤 ইউজার: <b>${escapeHtml(aState.target_name)}</b> (<code>${targetId}</code>)\n` +
                            `➕ যোগ করা হয়েছে: <b>+${formatNumber(amt)} ⭐</b>\n` +
                            `💰 বর্তমান ব্যালেন্স: <b>${formatNumber(newBal)} ⭐</b>`,
                            getAdminMenu(isSuperAdmin(fromId))
                        );
                        try {
                            await sendMessage(targetId, `🎁 <b>আপনার অ্যাকাউন্টে +${formatNumber(amt)} STAR যোগ করা হয়েছে!</b>\n💰 বর্তমান ব্যালেন্স: <b>${formatNumber(newBal)} STAR ⭐</b>`);
                        } catch {}
                    }
                    return;
                }

                // ব্যালেন্স কাট: ধাপ ১
                if (action === 'cut_balance_user') {
                    if (!/^\d+$/.test(text)) {
                        await sendMessage(chatId, "❌ <b>সঠিক Numeric Telegram User ID পাঠান:</b>", getCancelKeyboard());
                        return;
                    }
                    const targetUser = await getUser(text);
                    if (!targetUser) {
                        await sendMessage(chatId, "❌ <b>ইউজার পাওয়া যায়নি!</b>\n\nদয়া করে সঠিক User ID পাঠান:", getCancelKeyboard());
                        return;
                    }
                    await setAdminState(fromId, 'cut_balance_amount', {
                        target_id: text,
                        target_name: targetUser.first_name || 'User',
                        current_bal: Number(targetUser.balance || 0)
                    });
                    await sendMessage(chatId, 
                        `👤 <b>ইউজার পাওয়া গেছে!</b>\n━━━━━━━━━━━━━━━━━━\n` +
                        `• নাম: <b>${escapeHtml(targetUser.first_name || 'User')}</b>\n` +
                        `• আইডি: <code>${text}</code>\n` +
                        `• বর্তমান ব্যালেন্স: <b>${formatNumber(Number(targetUser.balance || 0))} ⭐</b>\n\n` +
                        `➖ <b>(ধাপ ২/২) কত STAR কাটতে চান সেই Amount লিখুন:</b>`, 
                        getCancelKeyboard()
                    );
                    return;
                }

                // ব্যালেন্স কাট: ধাপ ২
                if (action === 'cut_balance_amount') {
                    if (!isNumericAmount(text) || Number(text) <= 0) {
                        await sendMessage(chatId, "❌ <b>সঠিক Amount লিখুন:</b>", getCancelKeyboard());
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
                        await sendMessage(chatId, 
                            `✅ <b>ব্যালেন্স সফলভাবে কাটা হয়েছে!</b>\n━━━━━━━━━━━━━━━━━━\n` +
                            `👤 ইউজার: <b>${escapeHtml(aState.target_name)}</b> (<code>${targetId}</code>)\n` +
                            `➖ কাটা হয়েছে: <b>-${formatNumber(amt)} ⭐</b>\n` +
                            `💰 বর্তমান ব্যালেন্স: <b>${formatNumber(newBal)} ⭐</b>`,
                            getAdminMenu(isSuperAdmin(fromId))
                        );
                    }
                    return;
                }

                if (action === 'welcome_bonus' && isNumericAmount(text)) {
                    await setSetting('welcome_bonus', Number(text));
                    await clearAdminState(fromId);
                    await sendMessage(chatId, `🎁 <b>Welcome Bonus Updated: ${formatNumber(Number(text))} ⭐</b>`, getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (action === 'referral_bonus' && isNumericAmount(text)) {
                    await setSetting('referral_bonus', Number(text));
                    await clearAdminState(fromId);
                    await sendMessage(chatId, `👥 <b>Referral Bonus Updated: ${formatNumber(Number(text))} ⭐</b>`, getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (action === 'minimum_withdraw' && isNumericAmount(text)) {
                    await setSetting('min_withdraw', Number(text));
                    await clearAdminState(fromId);
                    await sendMessage(chatId, `💸 <b>ফিক্সড উইথড্র অ্যামাউন্ট সেট করা হয়েছে: ${formatNumber(Number(text))} ⭐</b>`, getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (action === 'withdraw_fee' && isNumericAmount(text)) {
                    await setSetting('withdraw_fee_percent', Number(text));
                    await clearAdminState(fromId);
                    await sendMessage(chatId, `📊 <b>Withdrawal Fee Updated: ${formatNumber(Number(text))}%</b>`, getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }

                if (action === 'payment_verification_channel' && isValidChannelTarget(text)) {
                    await setSetting('payment_verification_channel', text.trim());
                    await clearAdminState(fromId);
                    await sendMessage(chatId, "✅ <b>Payment/Verification Channel Updated!</b>", getAdminMenu(isSuperAdmin(fromId)));
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
                        await sendMessage(chatId, `🎉 <b>Gift Code Created: ${escapeHtml(parts[0].toUpperCase())}</b>`, getAdminMenu(isSuperAdmin(fromId)));
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
                    await sendMessage(chatId, `📢 <b>Broadcast Completed!</b>\n\nSent: ${s}, Failed: ${f}`, getAdminMenu(isSuperAdmin(fromId)));
                    return;
                }
            }
        }

        // USER STATE: WITHDRAWAL PROCESSING (FIXED EXACT AMOUNT)
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
                    await sendMessage(chatId, `⚠️ <b>Insufficient Balance!</b>\n\nউইথড্র করার জন্য আপনার ব্যালেন্সে কমপক্ষে <b>${formatNumber(fixedAmount)} STAR</b> প্রয়োজন।`, await getUserMenu(fromId));
                    await clearUserState(fromId);
                    return;
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
                    // শুধুমাত্র ফিক্সড অ্যামাউন্ট ব্যালেন্স থেকে কাটা হবে
                    await updateUser(fromId, { balance: Math.max(0, currentBalance - fixedAmount) });
                    await clearUserState(fromId);
                    await sendMessage(reqChannel, buildWithdrawRequestText(withdrawData, 'pending'), withdrawActionKeyboard(created.name));
                    await sendMessage(chatId, `🔔 <b>Withdrawal Submitted!</b>\n━━━━━━━━━━━━━━━━━━\n\n💰 Amount: <b>${formatNumber(fixedAmount)} STAR</b>\n📊 Fee: <b>${formatNumber(fee)}%</b>\n💵 After Fee: <b>${formatNumber(afterFee)} STAR</b>\n📬 To: <b>${escapeHtml(target)}</b>\n📌 Status: <b>PENDING ⏳</b>`, await getUserMenu(fromId));
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
                    await sendMessage(chatId, "⚠️ <b>You have already used this Gift Code.</b>", await getUserMenu(fromId));
                    await clearUserState(fromId);
                    return;
                }
                const reward = Number(gift.amount || 0);
                const u = await getUser(fromId);
                await updateUser(fromId, { balance: Number(u?.balance || 0) + reward });
                await firebaseRequest(`gift_claims/${code}/${fromId}`, 'PUT', { claimed_at: Math.floor(Date.now() / 1000), reward: reward });
                await firebaseRequest(`gift_codes/${code}`, 'PATCH', { used_count: Number(gift.used_count || 0) + 1 });
                await clearUserState(fromId);
                await sendMessage(chatId, `🎉 <b>Gift Code Redeemed!</b>\n\n⭐ Reward: <b>+${formatNumber(reward)} STAR</b>`, await getUserMenu(fromId));
                return;
            }
        }

        // TEXT COMMANDS & BUTTONS
        if (text.startsWith('/start')) {
            if (!isAdm && !(await isUserJoinedAllChannels(fromId))) {
                await showForceJoin(chatId);
                return;
            }
            
            const politeStartText = isAdm 
                ? `👋 <b>স্বাগতম, ${escapeHtml(msg.from.first_name || 'Admin')}!</b>\n━━━━━━━━━━━━━━━━━━\nআপনার জন্য অ্যাডমিন কন্ট্রোল প্যানেল প্রস্তুত রয়েছে।`
                : `🌟 <b>স্বাগতম, ${escapeHtml(msg.from.first_name || 'User')}!</b>\n━━━━━━━━━━━━━━━━━━\nআমাদের <b>Star Earning Bot</b>-এ আপনাকে স্বাগতম। নিচের মেনু থেকে আপনার কাঙ্ক্ষিত অপশন নির্বাচন করুন।`;

            await sendMessage(chatId, politeStartText, isAdm ? getAdminMenu(isSuperAdmin(fromId)) : await getUserMenu(fromId));
            return;
        }

        if (text === '🛠 Admin Panel' && isAdm) {
            await clearAdminState(fromId);
            await sendMessage(chatId, "🛠 <b>এডমিন কন্ট্রোল প্যানেল</b>\n━━━━━━━━━━━━━━━━━━\nনিচের অপশনগুলো ব্যবহার করুন:", getAdminMenu(isSuperAdmin(fromId)));
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

        // REFERRAL SECTION (ছবির মতো হুবহু ডিজাইন + SHARE & LEADERBOARD বাটন)
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

        // WITHDRAW BUTTON (FIXED EXACT AMOUNT AUTO SELECT)
        if (text === '💸 Withdraw') {
            const u = await getUser(fromId);
            const bal = Number(u?.balance || 0);
            const fixedAmount = Number(await getSetting('min_withdraw', 15));

            if (bal < fixedAmount) {
                await sendMessage(chatId, `⚠️ <b>Insufficient Balance!</b>\n━━━━━━━━━━━━━━━━━━\n\nউইথড্র করতে আপনার ব্যালেন্সে কমপক্ষে <b>${formatNumber(fixedAmount)} STAR</b> প্রয়োজন।\n💰 আপনার বর্তমান ব্যালেন্স: <b>${formatNumber(bal)} STAR</b>`);
                return;
            }

            await setUserState(fromId, 'withdraw_username');
            const withdrawPrompt = 
                `💸 <b>WITHDRAW STARS</b>\n` +
                `━━━━━━━━━━━━━━━━━━\n\n` +
                `💰 Withdrawal Amount: <b>${formatNumber(fixedAmount)} STAR</b> (Fixed)\n\n` +
                `যে Telegram Username-এ Stars পাঠাতে চান সেটি লিখুন:\n` +
                `উদাহরণ: <code>@username</code>`;

            await sendMessage(chatId, withdrawPrompt, getCancelKeyboard());
            return;
        }

        if (text === '🎁 Gift Code' && !isAdm) {
            await setUserState(fromId, 'gift_redeem');
            await sendMessage(chatId, "🎁 <b>REDEEM GIFT CODE</b>\n\nআপনার Gift Code পাঠান:", getCancelKeyboard());
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

        // ADMIN BUTTONS
        if (isAdm) {
            if (text === '📊 পরিসংখ্যান') {
                const users = await getAllUsers();
                const withdrawals = (await firebaseRequest('withdrawals')) || {};
                await sendMessage(chatId, `📊 <b>বট পরিসংখ্যান</b>\n\n👥 মোট ইউজার: <b>${Object.keys(users).length}</b>\n💸 মোট Withdrawal: <b>${Object.keys(withdrawals).length}</b>`);
                return;
            }
            if (text === '👥 User & Balance Management') {
                await sendMessage(chatId, "👥 <b>User & Balance Management</b>\n━━━━━━━━━━━━━━━━━━\nনিচের অপশন থেকে ইউজারের ব্যালেন্স নিয়ন্ত্রণ করুন:", balanceKeyboard());
                return;
            }
            if (text === '📢 Channel Settings') {
                const paymentChannel = await getPaymentVerificationChannel();
                const forceChannels = await getAllForceChannels();
                const requestChannel = await getWithdrawRequestChannel();
                const textOut = `📢 <b>CHANNEL SETTINGS</b>\n━━━━━━━━━━━━━━━━━━\n\n🔐 <b>Payment Channel:</b> <code>${escapeHtml(paymentChannel || 'Not Set')}</code>\n📢 <b>Force Channels:</b> <b>${Object.keys(forceChannels).length}</b>\n💸 <b>Request Channel:</b> <code>${escapeHtml(requestChannel || 'Not Set')}</code>`;
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
                await sendMessage(chatId, `🎁 <b>বোনাস সেটিংস</b>\n━━━━━━━━━━━━━━━━━━\n\n🎁 Welcome Bonus: <b>${formatNumber(welcome)} ⭐</b>\n👥 Referral Bonus: <b>${formatNumber(referral)} ⭐</b>`, bonusKeyboard());
                return;
            }
            if (text === '🎁 Gift Code') {
                await sendMessage(chatId, "🎁 <b>Gift Code Management</b>", giftKeyboard());
                return;
            }
            if (text === '💸 Withdraw Settings') {
                const min = Number(await getSetting('min_withdraw', 15));
                const fee = Number(await getSetting('withdraw_fee_percent', 0));
                await sendMessage(chatId, `💸 <b>Withdraw Settings</b>\n━━━━━━━━━━━━━━━━━━\n\n💰 Fixed Withdrawal Amount: <b>${formatNumber(min)} STAR</b>\n📊 Fee: <b>${formatNumber(fee)}%</b>`, withdrawSettingsKeyboard());
                return;
            }
            if (text === '👮 এডমিন ম্যানেজমেন্ট' && isSuperAdmin(fromId)) {
                await sendMessage(chatId, "👮 <b>এডমিন ম্যানেজমেন্ট</b>", adminManagementKeyboard());
                return;
            }
            if (text === '📢 ব্রডকাস্ট') {
                await setAdminState(fromId, 'broadcast');
                await sendMessage(chatId, "📢 <b>ব্রডকাস্ট মেসেজটি লিখে পাঠান:</b>", getCancelKeyboard());
                return;
            }
        }
    }
}

/*
|--------------------------------------------------------------------------
| VERCEL SERVERLESS EXPORT
|--------------------------------------------------------------------------
*/
module.exports = async (req, res) => {
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
