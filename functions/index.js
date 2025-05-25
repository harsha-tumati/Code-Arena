const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { execFile } = require('child_process');
const fs = require('fs');
const serviceAccount = require('./service-account.json'); // adjust path if needed

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

exports.runRound2 = functions.https.onCall(async (data, context) => {
  if (!context.auth)
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  if (!await isAdmin(context.auth.uid))
    throw new functions.https.HttpsError('permission-denied', 'User is not an admin');

  const maxTeams = data.limit && typeof data.limit === 'number' ? data.limit : 16;
  const roundResultRef = await db.collection('round2_results').add({
    round:        'round2',
    generatedAt:  Date.now(),
    status:       'running',
    results:      []
  });
  const roundResultId = roundResultRef.id;
  /* ── Collect best submission for every team ────────────── */
  const teamBest = [];
  const teamsSnap = await db.collection('teams').get();

  for (const doc of teamsSnap.docs) {
    const best = await db.collection('submissions')
        .where('teamId', '==', doc.id)
        .orderBy('score', 'desc').limit(1).get();

    if (!best.empty) {
      const s = best.docs[0], d = s.data();
      teamBest.push({
        teamId: doc.id,
        teamName: doc.data().name,
        submissionId: s.id,
        userId: d.userId,
        score: d.score,
        filePath: d.filePath,
      });
    }
  }
  console.log('teamBest', teamBest);
  if (teamBest.length < 2)
    throw new functions.https.HttpsError('failed-precondition', 'Need at least 2 teams');

  teamBest.sort((a, b) => b.score - a.score);
  const seeds = teamBest.slice(0, Math.min(maxTeams, teamBest.length));
  let bracket = [...seeds];

  const statusRef = db.collection('playoffs').doc('round2');
  await statusRef.set({
    status: 'running',
    startedAt: Date.now(),
    participants: bracket.map(t => t.teamId)
  });

  const ranking = seeds.map(t => ({ team: t, bestScore: t.score, place: 0 }));

  const labelOf = (n) => {
    switch (n) {
      case 2:  return 'F';
      case 4:  return 'SF';
      case 8:  return 'QF';
      case 16: return 'R16';
      default: return 'R' + n;
    }
  };

  async function playMatch(A, B, roundLabel, order) {
    const botA = await download(A.filePath);
    const botB = await download(B.filePath);
    const res  = await runEngineWithResult(botA, botB, `${A.teamId}_vs_${B.teamId}`);

    await db.collection('round2_playoffs').add({
      round: roundLabel,
      order,
      roundResultId,
      team1Id: A.teamId, team1UserId: A.userId, team1Score: res.p1Score,
      team2Id: B.teamId, team2UserId: B.userId, team2Score: res.p2Score,
      logCsv: res.csv,
      createdAt: Date.now()
    });

    /* update best-score for both */
    const rA = ranking.find(r => r.team.teamId === A.teamId);
    const rB = ranking.find(r => r.team.teamId === B.teamId);
    rA.bestScore = Math.max(rA.bestScore, res.p1Score);
    rB.bestScore = Math.max(rB.bestScore, res.p2Score);

    return (res.p1Score >= res.p2Score)
        ? { winner: A, loser: B, lScore: res.p2Score }
        : { winner: B, loser: A, lScore: res.p1Score };
  }

  /* ── Buckets will hold losers for each round ────────────── */
  const buckets = [];      // buckets[0] = earliest losers, etc.
  let roundIdx = 0;

  /* ── Run the bracket until we have a champion ───────────── */
  while (bracket.length > 1) {
    const roundLabel = labelOf(bracket.length);
    const losersThisRound = [];
    const winners = [];

    for (let i = 0; i < bracket.length; i += 2) {
      if (i + 1 < bracket.length) {
        // play a real match
        const { winner, loser, lScore } =
            await playMatch(bracket[i], bracket[i + 1], roundLabel, i / 2);
        winners.push(winner);

        // record loser’s latest score
        ranking.find(r => r.team.teamId === loser.teamId).bestScore = lScore;
        losersThisRound.push(loser);
      } else {
        // bye → straight to next round
        winners.push(bracket[i]);
      }
    }

    buckets.push(losersThisRound);
    bracket = winners;
    roundIdx += 1;
  }

  const champion = bracket[0];

  /* ── Assign positions 1…N (champion first, runner next …) ─ */
  let pos = 1;
  ranking.find(r => r.team.teamId === champion.teamId).place = pos++;

  for (let b = buckets.length - 1; b >= 0; b--) {
    buckets[b]
        .sort((a, b) =>   // sort this bucket by bestScore desc
            ranking.find(r => r.team.teamId === b.teamId).bestScore -
    ranking.find(r => r.team.teamId === a.teamId).bestScore)
  .forEach(teamObj => {
      ranking.find(r => r.team.teamId === teamObj.teamId).place = pos++;
    });
  }

  /* ── Build and persist final table ──────────────────────── */
  const finalTable = ranking
      .map(r => ({
        position: r.place,
        teamId: r.team.teamId,
        userId: r.team.userId,
        score: r.bestScore,
        teamName: r.team.teamName,
      }))
      .sort((a, b) => a.position - b.position);

  await roundResultRef.update({
    status:      'completed',
    completedAt: Date.now(),
    results:     finalTable
  });

  /* ── Mark completed & return ────────────────────────────── */
  await statusRef.update({ status: 'completed', completedAt: Date.now() });
  return { ok: true };
});

// Modified runEngine to return results instead of just resolve()
async function runEngineWithResult(bot1Path, bot2Path, matchId) {
  return new Promise((resolve, reject) => {
    const logFile = `/tmp/game_log_${Date.now()}_${matchId}.csv`;
    const enginePath = require('path').join(__dirname, 'engine', 'engine.py');

    execFile('python3', [enginePath, '--p1', bot1Path, '--p2', bot2Path, '--logfile', logFile], (error) => {
      if (error) return reject(error);

      const csv = fs.readFileSync(logFile, 'utf8');
      const lines = csv.trim().split('\n');
      const last = lines[lines.length - 1].split(',');

      const p1Score = Number(last[7]); // adjust indices if needed
      const p2Score = Number(last[8]);

      resolve({ csv, p1Score, p2Score });
    });
  });
}


//const { FieldValue } = admin.firestore;   // ← must be here, outside any function
const db = admin.firestore();



exports.getTeamSubmissions = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const uid = context.auth.uid;

  // 1. Find the team where the user is a member
  const teamSnap = await admin.firestore()
      .collection("teams")
      .where("members", "array-contains", uid)
      .limit(1)
      .get();

  if (teamSnap.empty) {
    throw new functions.https.HttpsError("failed-precondition", "User is not in a team.");
  }

  const teamDoc = teamSnap.docs[0];
  const teamId = teamDoc.id;

  // 2. Fetch all submissions for that team
  const submissionsSnap = await admin.firestore()
      .collection("submissions")
      .where("teamId", "==", teamId)
      .orderBy("created", "desc")
      .limit(20)
      .get();

  const submissions = submissionsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  return submissions;
});

// Team Management Functions
exports.createTeam = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { teamName } = data;
    if (!teamName || typeof teamName !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Team name is required');
    }

    // Validate team name
    const trimmedName = teamName.trim();
    if (trimmedName.length < 3 || trimmedName.length > 30) {
      throw new functions.https.HttpsError('invalid-argument', 'Team name must be between 3 and 30 characters');
    }

    // Check if team name already exists
    const existingTeam = await db.collection('teams')
      .where('name', '==', trimmedName)
      .get();

    if (!existingTeam.empty) {
      throw new functions.https.HttpsError('already-exists', 'A team with this name already exists');
    }

    // Check if user is already in a team
    const userTeams = await db.collection('teams')
      .where('members', 'array-contains', context.auth.uid)
      .get();

    if (!userTeams.empty) {
      throw new functions.https.HttpsError('already-exists', 'User is already in a team');
    }

    const teamRef = await db.collection('teams').add({
      name: trimmedName,
      members: [context.auth.uid],
      memberEmails: [context.auth.token.email],
      memberCount: 1,
      createdAt: Date.now(),
      createdBy: context.auth.uid
    });

    return { teamId: teamRef.id };
  } catch (error) {
    console.error('Error creating team:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to create team');
  }
});

exports.joinTeam = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { teamId } = data;
    if (!teamId || typeof teamId !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Team ID is required');
    }

    // Check if user is already in a team
    const userTeams = await db.collection('teams')
        .where('members', 'array-contains', context.auth.uid)
        .get();

    if (!userTeams.empty) {
      throw new functions.https.HttpsError('already-exists', 'User is already in a team');
    }

    const teamRef = db.collection('teams').doc(teamId);
    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Team not found');
    }

    const teamData = teamDoc.data();

    // Check if team is full
    if (teamData.memberCount >= 3) {
      throw new functions.https.HttpsError('failed-precondition', 'Team is full');
    }

    // Check if user is already a member
    if (teamData.members.includes(context.auth.uid)) {
      return { success: true, message: 'Already a member' };
    }

    // Check if user's email is already in the team
    if (teamData.memberEmails.includes(context.auth.token.email)) {
      throw new functions.https.HttpsError('failed-precondition', 'A user with this email is already in the team');
    }

    // Create new team data with the new member
    const newTeamData = {
      ...teamData,
      members: [...teamData.members, context.auth.uid],
      memberEmails: [...teamData.memberEmails, context.auth.token.email],
      memberCount: teamData.memberCount + 1,
      updatedAt: Date.now()
    };

    // Set the entire document with new data
    await teamRef.set(newTeamData);

    return { success: true };
  } catch (error) {
    console.error('Error joining team:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to join team');
  }
});
// Get user's team information
exports.getUserTeam = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userTeams = await db.collection('teams')
      .where('members', 'array-contains', context.auth.uid)
      .get();

    if (userTeams.empty) {
      return null;
    }

    const teamDoc = userTeams.docs[0];
    const teamData = teamDoc.data();

    // Get user information for all team members
    const memberPromises = teamData.members.map(async (memberId) => {
      const userDoc = await admin.auth().getUser(memberId);
      return {
        id: memberId,
        displayName: userDoc.displayName || userDoc.email,
        email: userDoc.email,
        photoURL: userDoc.photoURL,
        isLeader: memberId === teamData.createdBy
      };
    });

    const members = await Promise.all(memberPromises);

    return {
      id: teamDoc.id,
      name: teamData.name,
      memberCount: teamData.memberCount,
      members,
      createdAt: teamData.createdAt
    };
  } catch (error) {
    console.error('Error getting user team:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to get team information');
  }
});

// Search teams by name
exports.searchTeams = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { query } = data;
    if (!query || typeof query !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Search query is required');
    }

    const searchQuery = query.trim().toLowerCase();
    if (searchQuery.length < 2) {
      return []; // Return empty array for very short queries
    }

    // Get all teams that match the search query
    const teamsSnapshot = await db.collection('teams')
      .orderBy('name')
      .get();

    // Filter teams client-side for more flexible matching
    const teams = teamsSnapshot.docs
      .map(doc => ({
        id: doc.id,
        name: doc.data().name,
        memberCount: doc.data().memberCount
      }))
      .filter(team => 
        team.name.toLowerCase().includes(searchQuery) &&
        team.memberCount < 3 // Only show teams that aren't full
      )
      .slice(0, 10); // Limit to 10 results

    return teams;
  } catch (error) {
    console.error('Error searching teams:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to search teams');
  }
});

async function runEngine(enginePath, p1, p2, uid, fileName = 'submission.py') {
  return new Promise((res, rej) => {
    const execFile = require('child_process').execFile;
    const logFile = `/tmp/game_log_${Date.now()}_${uid}.csv`;
    const path = require('path');
    const enginePath = path.join(__dirname, 'engine', 'engine.py');
    execFile('python3', [enginePath, '--p1', p1, '--p2', p2, '--logfile', logFile], async (error) => {
      if (error) return rej(error);
      const csv = fs.readFileSync(logFile, 'utf8');
      const lines = csv.trim().split('\n');
      const last = lines[lines.length - 1].split(',');
      const p1Score = Number(last[7]);  // adjust index as needed
      const p2Score = Number(last[8]);  // adjust index as needed
      const score = p2Score - p1Score;
      async function getTeamIdForUser(userId) {
        const teamsRef = db.collection('teams');
        const querySnapshot = await teamsRef.where('members', 'array-contains', userId).get();

        if (querySnapshot.empty) {
          throw new Error("No team found for user");
        }

        return querySnapshot.docs[0].id; // assuming one team per user
      }
      const teamId = await getTeamIdForUser(uid);
      const data = await db.collection('submissions').add({filePath:`submissions/${fileName}`,userId: uid,teamId: teamId, score, created: Date.now()});
      await db.collection('logs').add({userId: uid,teamId: teamId, csv, created: Date.now(), submissionId: data.id});
      res();
    });
  });
}


async function isAdmin(uid) {
  const adminDoc = await db.collection('admins').doc(uid).get();
  return adminDoc.exists;
}


async function download(filePath) {
  const fileName = filePath.split('/').pop(); // extract filename from path
  const dst = `/tmp/${fileName}`;
  const file = admin.storage().bucket('code-arena-44042.firebasestorage.app').file(filePath);
  await file.download({ destination: dst });
  return dst;
}


// Get current user's submission
exports.getCurrentSubmission = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const submission = await db.collection('submissions')
      .where('userId', '==', context.auth.uid)
      .orderBy('created', 'desc')
      .limit(1)
      .get();

    if (submission.empty) {
      return null;
    }

    return submission.docs[0].data();
  } catch (error) {
    console.error('Error getting submission:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get submission');
  }
});

exports.checkIsAdmin = functions.https.onCall(async (data, context) => {
  try {
    const uid = context.auth?.uid || data.uid;

    if (!uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated or uid must be provided');
    }

    console.log('Checking admin for uid:', uid);

    const adminDoc = await db.collection('admins').doc(uid).get();

    return { isAdmin: adminDoc.exists };
  } catch (error) {
    console.error('Error checking admin status:', error);
    throw new functions.https.HttpsError('internal', 'Failed to check admin status');
  }
});

// Run game with uploaded bot
exports.runGame = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Check if user is in a team
    const userTeams = await db.collection('teams')
      .where('members', 'array-contains', context.auth.uid)
      .get();
    if (userTeams.empty) {
      throw new functions.https.HttpsError('failed-precondition', 'You must be in a team to upload a game bot.');
    }

    const { botUrl, fileName } = data;
    if (!botUrl) {
      throw new functions.https.HttpsError('invalid-argument', 'Bot URL is required');
    }

    // Always use the real bucket name, even in emulator
    const bucket = admin.storage().bucket('code-arena-44042.firebasestorage.app');

    // Download the bot file
    const botFile = `/tmp/${fileName}`;
    await bucket.file(`submissions/${fileName}`).download({ destination: botFile });

    // Run the game
    const engine = './engine/engine.py';
    const systemBot = './engine/system_bot.py';
    await runEngine(engine, botFile, systemBot, context.auth.uid, fileName);

    // Get the latest submission
    const submission = await db.collection('submissions')
      .where('userId', '==', context.auth.uid)
      .orderBy('created', 'desc')
      .limit(1)
      .get();

    if (submission.empty) {
      throw new functions.https.HttpsError('not-found', 'Submission not found');
    }

    return submission.docs[0].data();
  } catch (error) {
    console.error('Error running game:', error);
    throw new functions.https.HttpsError('internal', 'Failed to run game');
  }
});

// Get user's latest game state (log)
exports.getGameState = functions.https.onCall(async (data = {}, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { submissionId } = data;
    console.log('submissionId', submissionId);

    // Get the latest log for the user
    let logsSnapRaw = await db.collection('logs')
      .where('userId', '==', context.auth.uid)
      .orderBy('created', 'desc')
      .limit(1)

    if(submissionId){
      logsSnapRaw = logsSnapRaw.where('submissionId', '==', submissionId)
    }
    const logsSnap = await logsSnapRaw.get();

    if (logsSnap.empty) {
      return null;
    }

    const logData = logsSnap.docs[0].data();
    const csv = logData.csv;
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',');
    const steps = lines.slice(1).map(line => {
      const values = line.split(',');
      const step = {};
      headers.forEach((h, i) => {
        step[h] = isNaN(values[i]) ? values[i] : Number(values[i]);
      });
      return step;
    });
    return { steps };
  } catch (error) {
    console.error('Error getting game state:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get game state');
  }
});

//Leaderboard function
exports.getLeaderboard = functions.https.onCall(async (data, context) => {
  try {
    const submissionsSnap = await db.collection('submissions')
        .orderBy('score', 'desc')
        .limit(100)
        .get();

    const teamBestSubmissions = new Map();

    for (const doc of submissionsSnap.docs) {
      const data = doc.data();

      // Fetch team info
      const teamsSnap = await db.collection('teams')
          .where('members', 'array-contains', data.userId)
          .limit(1)
          .get();

      if (teamsSnap.empty) continue;

      const teamDoc = teamsSnap.docs[0];
      const teamId = teamDoc.id;
      const teamName = teamDoc.data().name;

      const existing = teamBestSubmissions.get(teamId);
      if (!existing || data.score > existing.score) {
        teamBestSubmissions.set(teamId, {
          teamId,
          teamName,
          userId: data.userId,
          score: data.score,
        });
      }
    }

    const users = await Promise.all(
        Array.from(teamBestSubmissions.values()).map(async (entry, idx) => {
          let displayName = entry.userId;
          let photoURL = '';

          try {
            const userRecord = await admin.auth().getUser(entry.userId);
            displayName = userRecord.displayName || userRecord.email || entry.userId;
            photoURL = userRecord.photoURL || '';
          } catch (e) {}

          return {
            id: entry.teamId,
            displayName,
            photoURL,
            score: entry.score,
            rank: idx + 1,
            team: {
              id: entry.teamId,
              name: entry.teamName,
            },
          };
        })
    );

    // Sort again, just in case
    users.sort((a, b) => b.score - a.score);
    users.forEach((u, i) => u.rank = i + 1);

    return users;
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get leaderboard');
  }
});

exports.getRound2Matches = functions.https.onCall(async (_, context) => {
  try {
    // Step 1: Build teamsMap from the 'teams' collection
    const teamsSnapshot = await admin.firestore().collection("teams").get();
    const teamsMap = {};
    teamsSnapshot.forEach(doc => {
      const data = doc.data();
      teamsMap[doc.id] = {
        name: data.name || "Unnamed",
      };
    });

    // Step 2: Fetch and group round2 matches
    const snapshot = await admin.firestore()
        .collection("round2_playoffs")
        .orderBy("createdAt", "desc")
        .get();

    const groupedMatches = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      const round = data.round?.toString() || 'Unknown';
      const team1Name = teamsMap[data.team1Id]?.name || data.team1Id;
      const team2Name = teamsMap[data.team2Id]?.name || data.team2Id;

      if (!groupedMatches[round]) {
        groupedMatches[round] = [];
      }

      groupedMatches[round].push({
        id: data.id,
        order: data.order,
        roundResultId: data.roundResultId,
        team1Id: data.team1Id,
        team1Name,
        team1Score: data.team1Score,
        team2Id: data.team2Id,
        team2Name,
        team2Score: data.team2Score,
        createdAt: data.createdAt,
        logCsv: data.logCsv,
      });
    });

    // Step 3: Convert to array and sort by round number descending
    const sortedRounds = Object.entries(groupedMatches)
        .sort(([roundA], [roundB]) => {
          const numA = parseInt(roundA.replace(/\D/g, ""), 10) || 0;
          const numB = parseInt(roundB.replace(/\D/g, ""), 10) || 0;
          return numB - numA; // descending order
        })
        .map(([round, matches]) => ({ round, matches }));

    return { success: true, matches: sortedRounds };

  } catch (error) {
    console.error("Error fetching round2 matches:", error);
    return { success: false, error: error.message };
  }
});



exports.getLatestRound2Results = functions.https.onCall(async (data, context) => {
  try {
    const snapshot = await admin.firestore()
        .collection("round2_results")
        .orderBy("generatedAt", "desc")
        .limit(1)
        .get();

    if (snapshot.empty) {
      return { results: [], found: false };
    }

    const doc = snapshot.docs[0];
    const docData = doc.data();
    const results = docData.results || [];

    return { results, found: true };
  } catch (error) {
    console.error("Error fetching Round 2 results:", error);
    throw new functions.https.HttpsError("internal", "Failed to fetch Round 2 results.");
  }
});

// exports.getTeamNames = functions.https.onCall(async (data, context) => {
//   try {
//     const snapshot = await admin.firestore()
//         .collection("teams")
//         .get();
//   }
// })

// Delete current submission
// exports.deleteSubmission = functions.https.onCall(async (data, context) => {
//   try {
//     if (!context.auth) {
//       throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
//     }
//
//     // Delete from Firestore
//     const submission = await db.collection('submissions')
//       .where('userId', '==', context.auth.uid)
//       .orderBy('created', 'desc')
//       .limit(1)
//       .get();
//
//     if (!submission.empty) {
//       await submission.docs[0].ref.delete();
//     }
//
//     // Delete from Storage
//     const fileRef = admin.storage().bucket('code-arena-44042.appspot.com').file(`submissions/${context.auth.uid}.py`);
//     try {
//       await fileRef.delete();
//     } catch (error) {
//       console.error('Error deleting file:', error);
//     }
//
//     return { success: true };
//   } catch (error) {
//     console.error('Error deleting submission:', error);
//     throw new functions.https.HttpsError('internal', 'Failed to delete submission');
//   }
// });