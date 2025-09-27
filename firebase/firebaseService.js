import admin from 'firebase-admin';

let db = null;

export function initializeFirebase() {
  console.log('Debug - PROJECT_ID:', process.env.FIREBASE_PROJECT_ID);
  console.log('Debug - CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL);
  console.log('Debug - PRIVATE_KEY exists:', !!process.env.FIREBASE_PRIVATE_KEY);
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  db = admin.firestore();
  console.log('🔥 Firebase initialized');
}

const hardcodedMicroBets = [
  {
    question: "Who scores the next touchdown?",
    options: [
      {id: "opt1", text: "Georgia Tech", votes: 0},
      {id: "opt2", text: "University of Georgia", votes: 0}
    ],
    sponsor: "Nike",
    maxDonation: 1000
  },
  {
    question: "Will the next play be a run or pass?",
    options: [
      {id: "opt1", text: "Run", votes: 0},
      {id: "opt2", text: "Pass", votes: 0}
    ],
    sponsor: "Adidas",
    maxDonation: 500
  },
  {
    question: "Who will get the next first down?",
    options: [
      {id: "opt1", text: "Georgia Tech", votes: 0},
      {id: "opt2", text: "University of Georgia", votes: 0}
    ],
    sponsor: "Under Armour",
    maxDonation: 750
  }
];

export async function createMicroBet(playCount) {
  if (!db) {
    console.log('⚠️  Skipping microbet creation - Firebase not initialized');
    return;
  }

  try {
    const betTemplate = hardcodedMicroBets[playCount % hardcodedMicroBets.length];
    const microBet = {
      ...betTemplate,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('microBets').add(microBet);
    console.log('🎲 MicroBet created:', docRef.id, '-', microBet.question);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating microbet:', error);
    throw error;
  }
}