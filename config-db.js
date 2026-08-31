const mongoose = require("mongoose");

/**
 * ============================================================
 *  SEHEMU YA KUJAZA MONGODB
 * ============================================================
 * 1. Fungua akaunti MongoDB Atlas (bure): https://www.mongodb.com/cloud/atlas
 * 2. Tengeneza Cluster (free tier M0 inatosha kuanzia)
 * 3. Database Access -> tengeneza user + password
 * 4. Network Access -> ruhusu IP (0.0.0.0/0 ili Render iweze kufikia)
 * 5. Connect -> Drivers -> copy connection string
 * 6. Weka string hiyo kwenye .env kama MONGODB_URI
 *    Mfano:
 *    MONGODB_URI=mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/darkxchat
 *
 * Kwenye Render: Settings -> Environment -> Add Environment Variable
 *    Key: MONGODB_URI   Value: <connection string yako>
 * ============================================================
 */

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error(
      "\n[MONGODB] ❌ MONGODB_URI haijawekwa kwenye .env — jaza connection string kwanza.\n" +
      "[MONGODB] Angalia maelekezo hapo juu ndani ya config/db.js\n"
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      // Chaguo za kisasa za mongoose 8.x hazihitaji tena useNewUrlParser/useUnifiedTopology
    });
    console.log("[MONGODB] ✅ Imeunganishwa kikamilifu");
  } catch (err) {
    console.error("[MONGODB] ❌ Imeshindwa kuunganisha:", err.message);
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("[MONGODB] ⚠️ Connection imekatika, inajaribu tena...");
  });
};

module.exports = connectDB;
