const { onSchedule } = require("firebase-functions/v2/scheduler");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");

admin.initializeApp();

/**
 * Scheduled function that runs every 24 hours (e.g., at midnight).
 * It queries the "users" collection for everyone whose subscriptionEnd
 * has passed, and sets isSubscribed to false.
 */
exports.checkExpiredSubscriptions = onSchedule("every 24 hours", async (event) => {
    try {
        const db = admin.firestore();
        const now = admin.firestore.Timestamp.now();

        // Query active users whose subscription end date is before right now
        const snapshot = await db.collection("users")
            .where("isSubscribed", "==", true)
            .where("subscriptionEnd", "<", now)
            .get();

        if (snapshot.empty) {
            logger.info("No expired subscriptions found today.");
            return;
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            const userRef = db.collection("users").doc(doc.id);
            batch.update(userRef, { isSubscribed: false });
            logger.info(`Marked subscription as inactive for user ${doc.id}`);
        });

        await batch.commit();
        logger.info(`Successfully processed ${snapshot.size} expired subscriptions.`);
    } catch (error) {
        logger.error("Error checking expired subscriptions:", error);
    }
});

/**
 * Triggered automatically when a new user is created in Firebase Authentication.
 * Creates a corresponding document in the "app_users" Firestore collection.
 */
exports.syncNewUserToFirestore = functions.auth.user().onCreate(async (user) => {
    try {
        const db = admin.firestore();
        
        // Use the exact field structure expected by the Android app and Web Dashboard
        const initialData = {
            email: user.email || "",
            isSubscribed: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("app_users").doc(user.uid).set(initialData);
        logger.info(`Successfully created app_users document for new auth user: ${user.uid}`);
    } catch (error) {
        logger.error(`Error creating app_users document for ${user.uid}:`, error);
    }
});
