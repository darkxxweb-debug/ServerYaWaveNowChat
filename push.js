/**
 * Push notifications kupitia Firebase Cloud Messaging (HIARI / optional).
 *
 * App ya Kotlin (WaveFirebaseMessagingService.kt) inatuma FCM token yake kwa
 * server (PUT /api/users/me/fcm-token) na inasubiri push yenye
 * data: { chatId, content } wakati ujumbe mpya umefika ilhali app iko
 * background/imefungwa. Bila hii, chat bado inafanya kazi kikamilifu
 * kupitia Socket.io — hii ni kwa ajili tu ya notifications app ikiwa imefungwa.
 *
 * Jinsi ya kuwezesha kwa kweli:
 * 1. Firebase Console -> Project Settings -> Service Accounts
 *    -> "Generate new private key" (inapakua faili la JSON)
 * 2. Fanya JSON hiyo kuwa mstari mmoja (minify) na uiweke Render
 *    Environment Variable: FIREBASE_SERVICE_ACCOUNT=<json hiyo yote>
 * 3. Hakikisha "firebase-admin" iko kwenye package.json (tayari imeongezwa)
 *
 * Bila FIREBASE_SERVICE_ACCOUNT, function hii inajizima kimya kimya —
 * haitasababisha server kuanguka.
 */

let firebaseAdmin = null;
let attemptedInit = false;

function getAdmin() {
  if (attemptedInit) return firebaseAdmin;
  attemptedInit = true;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.log("[PUSH] ℹ️ FIREBASE_SERVICE_ACCOUNT haijawekwa — push notifications zimezimwa (chat bado inafanya kazi).");
    return null;
  }

  try {
    const admin = require("firebase-admin");
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseAdmin = admin;
    console.log("[PUSH] ✅ Firebase Admin imewezeshwa");
  } catch (err) {
    console.error("[PUSH] ❌ Imeshindwa kuwezesha Firebase Admin:", err.message);
    firebaseAdmin = null;
  }

  return firebaseAdmin;
}

/**
 * @param {Array} participantIds - Chat.participants (ObjectId au populated User docs)
 * @param {{ title: string, body: string, data?: Object }} notification
 */
async function sendPushToUsers(participantIds, notification) {
  const admin = getAdmin();
  if (!admin || !participantIds || !participantIds.length) return;

  try {
    const User = require("./models-User");
    const ids = participantIds.map((p) => (p && p._id ? p._id : p));

    const users = await User.find({
      _id: { $in: ids },
      fcmToken: { $ne: null },
    }).select("fcmToken");

    const tokens = users.map((u) => u.fcmToken).filter(Boolean);
    if (!tokens.length) return;

    const dataPayload = {};
    Object.entries(notification.data || {}).forEach(([k, v]) => {
      dataPayload[k] = String(v);
    });

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: dataPayload,
    });
  } catch (err) {
    console.error("[PUSH] ❌ Imeshindwa kutuma push:", err.message);
  }
}

module.exports = { sendPushToUsers };
