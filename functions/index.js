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

        // Query the "users" collection for users whose main document indicates an active subscription
        // and whose subscriptionEnd is before now.
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
 * Creates a corresponding document in the "users" Firestore collection.
 */
exports.syncNewUserToFirestore = functions.auth.user().onCreate(async (user) => {
    try {
        const db = admin.firestore();
        
        // Initial user document in the "users" collection
        const initialData = {
            email: user.email || "",
            isSubscribed: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Create the user's main document in "users"
        await db.collection("users").doc(user.uid).set(initialData);

        // Create placeholders in the new "users" structure
        const batch = db.batch();
        const userDoc = db.collection("users").doc(user.uid);
        batch.set(userDoc.collection("members").doc("_init"), { _placeholder: true, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        batch.set(userDoc.collection("plans").doc("_init"), { _placeholder: true, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        batch.set(userDoc.collection("payments").doc("_init"), { _placeholder: true, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        batch.set(userDoc.collection("attendance").doc("_init"), { _placeholder: true, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        await batch.commit();

        logger.info(`Successfully created user document and subcollections for ${user.uid} in "users"`);
    } catch (error) {
        logger.error(`Error creating user document for ${user.uid}:`, error);
    }
});
