import admin from 'firebase-admin';
import OpenAI from 'openai';

let db = null;
let openai = null;

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
  
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('🤖 OpenAI initialized with key:', process.env.OPENAI_API_KEY.substring(0, 10) + '...');
  } else {
    console.log('⚠️  No OpenAI API key found - will use fallback microbets');
  }
  
  console.log('🔥 Firebase initialized');
}

export async function createMicroBet(recentPlays) {
  if (!db) {
    console.log('⚠️  Skipping microbet creation - Firebase not initialized');
    return;
  }

  try {
    let microBet;
    
    if (openai) {
      console.log('🤖 Generating AI microbet...');
      try {
        microBet = await generateAIMicroBet(recentPlays);
        console.log('✅ AI microbet generated successfully');
      } catch (aiError) {
        console.error('❌ AI generation failed:', aiError.message);
        console.log('🔄 Falling back to hardcoded microbet');
        microBet = {
          question: "Who will score next?",
          options: [
            {id: "opt1", text: "Georgia Tech", votes: 0},
            {id: "opt2", text: "University of Georgia", votes: 0}
          ],
          sponsor: "Nike",
          maxDonation: 1000
        };
      }
    } else {
      console.log('🔄 Using fallback microbet - OpenAI not available');
      microBet = {
        question: "Who will score next?",
        options: [
          {id: "opt1", text: "Georgia Tech", votes: 0},
          {id: "opt2", text: "University of Georgia", votes: 0}
        ],
        sponsor: "Nike",
        maxDonation: 1000
      };
    }

    microBet.status = "active";
    microBet.createdAt = admin.firestore.FieldValue.serverTimestamp();

    const docRef = await db.collection('microBets').add(microBet);
    console.log('🎲 MicroBet created:', docRef.id, '-', microBet.question);
    return { id: docRef.id, ...microBet };
  } catch (error) {
    console.error('❌ Error creating microbet:', error);
    throw error;
  }
}

async function generateAIMicroBet(recentPlays) {
  const prompt = `Based on these recent football plays, create a microbet question with 2 options that are SPECIFIC but BROAD enough to be fair betting options:

${JSON.stringify(recentPlays, null, 2)}

IMPORTANT: Create options that are:
1. Clear and measurable
2. Broad enough to have reasonable chances
3. Mutually exclusive categories

Good examples:
- "10+ yards gained" vs "Less than 10 yards gained"
- "Pass play" vs "Run play"
- "First down achieved" vs "No first down"
- "Touchdown or field goal" vs "Punt or turnover"
- "Sack or tackle for loss" vs "Positive yards gained"

Bad examples (too specific):
- "Pass to specific player" vs "Run by specific player"
- "Exactly 15 yards" vs "Incomplete to T.Kelce"

Bad examples (too vague):
- "Good play" vs "Bad play"
- "Team wins" vs "Team loses"

Create balanced options where both have reasonable chances of happening.

Return ONLY valid JSON in this exact format:
{
  "question": "What will happen on the next play?",
  "options": [
    {"id": "opt1", "text": "Balanced specific outcome 1", "votes": 0},
    {"id": "opt2", "text": "Balanced specific outcome 2", "votes": 0}
  ],
  "sponsor": "Nike",
  "maxDonation": 750
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 300
  });

  return JSON.parse(response.choices[0].message.content);
}

export async function updateMicroBetWithAnswer(betId, determiningPlay, microBet) {
  if (!db || !openai) {
    console.log('⚠️  Skipping answer update - services not initialized');
    return;
  }

  try {
    const prompt = `You must determine the correct answer to this microbet based on what actually happened in this play.

Microbet Question: "${microBet.question}"
Option 1: "${microBet.options[0].text}"
Option 2: "${microBet.options[1].text}"

What actually happened in this play:
${JSON.stringify(determiningPlay.payload, null, 2)}

IMPORTANT: Be very strict about matching. Only choose opt1 or opt2 if the play EXACTLY matches that option.

Rules:
- If the play exactly matches "${microBet.options[0].text}", return "opt1"
- If the play exactly matches "${microBet.options[1].text}", return "opt2"
- If the play does NOT exactly match either option (like a rush when options are touchdown/field goal), return "opt3"

Example: If options are "Touchdown" and "Field goal" but a rush happened, return "opt3".

Return ONLY valid JSON:
{"answer": "opt1" or "opt2" or "opt3", "actionDescription": "Brief description of what happened in this specific play"}`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 100
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    // Calculate donation based on answer
    let donation;
    if (result.answer === "opt3") {
      donation = Math.floor(microBet.maxDonation / 2);
    } else {
      donation = Math.floor(Math.random() * (microBet.maxDonation - 100) + 100);
    }
    
    await db.collection('microBets').doc(betId).update({
      answer: result.answer,
      donation: donation,
      actionDescription: result.actionDescription,
      status: "closed",
      closedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ MicroBet closed:', betId, 'Question:', microBet.question, 'Answer:', result.answer, 'Action:', result.actionDescription);
  } catch (error) {
    console.error('❌ Error updating microbet:', error);
  }
}