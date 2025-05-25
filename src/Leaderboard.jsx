import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db } from './firebase';  // Your firebase exports
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  useTheme,
  Chip,
  Avatar,
  Button,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Group as TeamIcon,
} from '@mui/icons-material';
import { doc, getDoc } from "firebase/firestore";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";

const Leaderboard = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);  // Admin state
  const [round2Loading, setRound2Loading] = useState(false);
  const [round2Message, setRound2Message] = useState('');
  const functions = getFunctions();
  const theme = useTheme();
  const [round2Results, setRound2Results] = useState([]);
  const [round2Loaded, setRound2Loaded] = useState(false);
  //const [round2Message1, setRound2Message1] = useState('');



  const fetchRound2Results = async () => {
    try {
      const getLatestRound2Results = httpsCallable(functions, 'getLatestRound2Results');
      const result = await getLatestRound2Results();
      const { results, found } = result.data;

      if (found) {
        setRound2Results(results);
        setRound2Loaded(true);
      } else {
        setRound2Results([]);
        setRound2Loaded(false);
      }
    } catch (error) {
      console.error("Error loading Round 2 results:", error);
      setRound2Message("Failed to load Round 2 results.");
      setRound2Loaded(false);
    }
  };


  const fetchLeaderboard = async () => {
    setLoading(true);
    setError('');
    try {
      const getLeaderboardFn = httpsCallable(functions, 'getLeaderboard');
      const result = await getLeaderboardFn();
      setUsers(result.data);

      const currentUserData = result.data.find(user => user.id === auth.currentUser?.uid);
      setCurrentUser(currentUserData);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setError(error.message || 'Failed to fetch leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const checkIsAdmin = async () => {
    setLoading(true);
    setError('');
    try {
      const checkIsAdminFn = httpsCallable(functions, 'checkIsAdmin');
      const result = await checkIsAdminFn();
      console.log('Result:', result);
      setIsAdmin(result.data.isAdmin);
    } catch (error) {
      //console.error('Error fetching leaderboard:', error);
      setError(error.message || 'Failed to fetch leaderboard');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let unsubAuth;
    checkIsAdmin();
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    fetchRound2Results();
    return () => {
      if (unsubAuth) unsubAuth();
      clearInterval(interval);
    };
  }, []);

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up':
        return <TrendingUpIcon sx={{ color: theme.palette.success.main }} />;
      case 'down':
        return <TrendingDownIcon sx={{ color: theme.palette.error.main }} />;
      default:
        return <TrendingFlatIcon sx={{ color: theme.palette.info.main }} />;
    }
  };

  // New runRound2 function calling your updated Cloud Function
  const runRound2 = async () => {
    setRound2Loading(true);
    setRound2Message('');
    try {
      const runRound2Fn = httpsCallable(functions, 'runRound2');
      const response = await runRound2Fn({ limit: 16 }); // pass limit param if needed
      if (response.data.ok) {
        setRound2Message('Round 2 playoffs started successfully!');
        //await new Promise(res => setTimeout(res, 10000));
        await fetchRound2Results();
      } else {
        setRound2Message('Failed to start Round 2 playoffs.');
      }
    } catch (err) {
      console.error('Error starting Round 2 playoffs:', err);
      setRound2Message('Error: ' + (err.message || 'Unknown error'));
    } finally {
      setRound2Loading(false);
    }
  };

  return (
      <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
        <Container maxWidth="lg" sx={{ mt: 8, mb: 4 }}>
          <Paper
              elevation={3}
              sx={{
                p: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
          >
            <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: `${theme.palette.warning.main}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 3,
                }}
            >
              <TrophyIcon sx={{ fontSize: 40, color: theme.palette.warning.main }} />
            </Box>

            <Typography variant="h4" component="h1" gutterBottom align="center">
              Leaderboard
            </Typography>

            {/* Admin button for Round 2 playoffs */}
            {isAdmin && (
                <Box sx={{ mb: 3, width: '100%', textAlign: 'center' }}>
                  <Button
                      variant="contained"
                      color="secondary"
                      onClick={runRound2}
                      disabled={round2Loading}
                  >
                    {round2Loading ? 'Starting Round 2...' : 'Run Round 2 Playoffs'}
                  </Button>
                  {round2Message && (
                      <Typography
                          variant="body2"
                          color={round2Message.startsWith('Error') ? 'error' : 'success.main'}
                          sx={{ mt: 1 }}
                      >
                        {round2Message}
                      </Typography>
                  )}
                </Box>
            )}

            {currentUser && (
                <Paper
                    elevation={2}
                    sx={{
                      p: 2,
                      mb: 3,
                      width: '100%',
                      bgcolor: 'primary.light',
                      color: 'primary.contrastText',
                    }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar src={currentUser?.photoURL || undefined} alt={currentUser?.displayName}>
                      {currentUser?.displayName ? currentUser.displayName[0] : 'U'}
                    </Avatar>
                    <Box>
                      <Typography variant="h6">
                        Your Rank: #{currentUser.rank}
                      </Typography>
                      <Typography variant="body2">
                        Score: {currentUser.score} | Team: {currentUser.team?.name || 'No Team'}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
            )}

            {error && (
                <Typography color="error" sx={{ mb: 3 }}>
                  {error}
                </Typography>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                  <CircularProgress />
                </Box>
            ) : (
                <TableContainer component={Paper} sx={{ width: '100%', mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Rank</TableCell>
                        <TableCell>User</TableCell>
                        <TableCell>Team</TableCell>
                        <TableCell align="right">Score</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {users.map((user, index) => (
                          <TableRow
                              key={user.id}
                              sx={{
                                '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                                '&:hover': { bgcolor: 'action.selected' },
                                ...(user.id === auth.currentUser?.uid && {
                                  bgcolor: 'primary.light',
                                  '&:hover': { bgcolor: 'primary.light' },
                                }),
                              }}
                          >
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {index < 3 ? (
                                    <Chip
                                        label={`#${index + 1}`}
                                        color={
                                          index === 0
                                              ? 'warning'
                                              : index === 1
                                                  ? 'secondary'
                                                  : 'primary'
                                        }
                                        size="small"
                                    />
                                ) : (
                                    <Typography>#{index + 1}</Typography>
                                )}
                              </Box>
                            </TableCell>

                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar src={user.photoURL || undefined} alt={user.displayName} sx={{ width: 32, height: 32 }}>
                                  {user.displayName ? user.displayName[0] : 'U'}
                                </Avatar>
                                <Typography variant="body1">
                                  {user.displayName}
                                </Typography>
                              </Box>
                            </TableCell>

                            <TableCell>
                              {user.team ? (
                                  <Chip
                                      icon={<TeamIcon />}
                                      label={user.team.name}
                                      size="small"
                                      color="primary"
                                      variant="outlined"
                                  />
                              ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    No Team
                                  </Typography>
                              )}
                            </TableCell>

                            <TableCell align="right">
                              <Typography variant="body1" fontWeight="bold">
                                {user.score}
                              </Typography>
                            </TableCell>
                          </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
            )}
            {round2Loaded && round2Results.length > 0 && (
                <Box sx={{ mt: 6, width: '100%' }}>
                  <Typography variant="h5" gutterBottom>
                    Round 2 Results
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Position</TableCell>
                          <TableCell>Team Name</TableCell>
                          <TableCell>Team ID</TableCell>
                          <TableCell align="right">Score</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {round2Results.map((res, index) => (
                            <TableRow key={res.teamId}>
                              <TableCell>
                                <Chip label={`#${res.position}`} size="small" />
                              </TableCell>
                              <TableCell>{res.teamName}</TableCell>
                              <TableCell>{res.teamId}</TableCell>
                              <TableCell align="right">
                                <Typography fontWeight="bold">{res.score}</Typography>
                              </TableCell>
                            </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
            )}
          </Paper>
        </Container>
      </Box>
  );
};

export default Leaderboard;
