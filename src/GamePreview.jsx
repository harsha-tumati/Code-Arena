import React, { useRef, useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
//import { auth } from './firebase';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  CircularProgress,
  useTheme,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Alert,
  Stack,
  Slider,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Replay as ReplayIcon,
  Speed as SpeedIcon,
  EmojiEvents as TrophyIcon,
  SportsEsports as GameIcon,
} from '@mui/icons-material';

const canvasWidth = 400;
const canvasHeight = 400;
const scale = 12;
const ballRadius = 8;
const paddleWidth = 4 * scale;
const paddleHeight = 2.5 * scale;

const colors = {
  background: '#f8fafc',
  grid: '#e0e0e0',
  ball: '#e53935',
  paddle1: '#43a047',
  paddle2: '#1e88e5',
  text: '#222',
  shadow: 'rgba(0,0,0,0.08)'
};

const GamePreview = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gameState, setGameState] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [step, setStep] = useState(0);
  const intervalRef = useRef(null);
  const canvasRef = useRef(null);
  const functions = getFunctions();
  const theme = useTheme();
  const [pastSubmissions, setPastSubmissions] = useState([]);
  const [currentSubmission, setCurrentSubmission] = useState('');

  const fetchGameState = async (data = {}) => {
    console.log('fetchGameState called', data);
    setLoading(true);
    try {
      const getGameStateFn = httpsCallable(functions, 'getGameState');
      console.log('Calling getGameState Function');
      const result = await getGameStateFn(data);
      console.log('getGameState result:', result);
      setGameState(result.data);
      setStep(0);
    } catch (error) {
      console.error('Error fetching game state:', error);
      setError(error.message || 'Failed to fetch game state');
    } finally {
      setLoading(false);
    }
  };

  const fetchPastSubmissions = async () => {
    setLoading(true);
    // Fetch all past team submissions
    const getTeamSubmissionsFn = httpsCallable(functions, 'getTeamSubmissions');
    const pastResult = await getTeamSubmissionsFn();
    setPastSubmissions(pastResult.data || []);
    setCurrentSubmission(pastResult.data[0] || {});
    console.log('Past submissions:', pastResult.data);
    setLoading(false);
  };

  useEffect(() => {
    console.log('GamePreview useEffect running');

    fetchPastSubmissions().then();

    fetchGameState().then();
  }, []);

  // Animation effect
  useEffect(() => {
    if (!gameState?.steps || gameState.steps.length === 0) return;
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setStep(prev => (prev + 1) % gameState.steps.length);
      }, 100 / playbackSpeed);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, gameState, playbackSpeed]);

  // Drawing effect
  useEffect(() => {
    if (!gameState?.steps || gameState.steps.length === 0) return;
    const context = canvasRef.current.getContext('2d');
    context.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw background
    context.fillStyle = colors.background;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw grid
    context.strokeStyle = colors.grid;
    context.lineWidth = 1;
    for (let x = 0; x <= canvasWidth; x += scale) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvasHeight);
      context.stroke();
    }
    for (let y = 0; y <= canvasHeight; y += scale) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvasWidth, y);
      context.stroke();
    }

    const frame = gameState.steps[step];
    if (!frame) return;
    const ballX = frame.ball_x * scale;
    const ballY = canvasHeight - (frame.ball_y * scale);
    const paddle1X = frame.paddle1_x * scale;
    const paddle2X = frame.paddle2_x * scale;
    const paddle1Y = canvasHeight - paddleHeight - 4;
    const paddle2Y = 4;

    // Ball shadow
    context.beginPath();
    context.arc(ballX + scale / 2 + 2, ballY - ballRadius + 2, ballRadius, 0, 2 * Math.PI);
    context.fillStyle = colors.shadow;
    context.fill();
    // Ball
    context.beginPath();
    context.arc(ballX + scale / 2, ballY - ballRadius, ballRadius, 0, 2 * Math.PI);
    context.fillStyle = colors.ball;
    context.shadowColor = colors.shadow;
    context.shadowBlur = 4;
    context.fill();
    context.shadowBlur = 0;

    // Paddle 1 (bottom, You)
    context.fillStyle = colors.paddle1;
    context.beginPath();
    context.roundRect(paddle1X, paddle1Y, paddleWidth, paddleHeight, 8);
    context.fill();
    // Paddle 2 (top, System)
    context.fillStyle = colors.paddle2;
    context.beginPath();
    context.roundRect(paddle2X, paddle2Y, paddleWidth, paddleHeight, 8);
    context.fill();

    // Draw labels just outside the game area
    context.font = 'bold 18px Roboto, Arial';
    context.textAlign = 'center';
    context.fillStyle = colors.paddle1;
    context.fillText('You', paddle1X + paddleWidth / 2, canvasHeight - 8);
    context.fillStyle = colors.paddle2;
    context.fillText('System', paddle2X + paddleWidth / 2, 24);
  }, [step, gameState]);

  const handlePlayPause = () => setIsPlaying(prev => !prev);
  const handleRestart = () => {
    setStep(0);
    setIsPlaying(false);
  };
  const handleSeek = (_, value) => setStep(value);
  const handleSpeedChange = () => {
    const speeds = [1, 2, 4];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIndex]);
  };

  console.log('currentSubmission', currentSubmission, gameState);

  return (
    <Box sx={{
      flexGrow: 1,
      minHeight: '100vh',
      bgcolor: 'linear-gradient(135deg, #e3f2fd 0%, #f8fafc 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      py: 6,
    }}>
      <Container disableGutters>
        {pastSubmissions.length > 0 && (
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Past Submissions</Typography>
              <Grid container spacing={2}>
                {pastSubmissions.map((sub) => (
                    <Grid item xs={12} sm={6} md={4} key={sub.uid}>
                      <Card
                          sx={{ cursor: 'pointer', ':hover': { boxShadow: 6 } }}
                          onClick={() => {
                            setCurrentSubmission(sub)
                            fetchGameState({submissionId: sub.id}).then()
                          }
                      }
                      >
                        <CardContent>
                          <Typography variant="subtitle2">Score: {sub.score ?? 'N/A'}</Typography>
                          <Typography variant="caption">
                            {new Date(sub.created).toLocaleString()}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                ))}
              </Grid>
            </Paper>
        )}
        <Paper
          elevation={6}
          sx={{
            p: { xs: 2, sm: 4 },
            borderRadius: 5,
            boxShadow: '0 8px 32px 0 rgba(30,136,229,0.10)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.95)',
          }}
        >
          {/* Header with icon */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <GameIcon sx={{ fontSize: 40, color: 'primary.main', mr: 1 }} />
            <Typography variant="h4" fontWeight={700} color="primary.main">
              Game Preview
            </Typography>
          </Box>

          {/* Game summary */}
          {gameState?.steps && gameState.steps.length > 0 && (
            <Box sx={{ mb: 3, textAlign: 'center', width: '100%' }}>
              <Stack direction="row" spacing={2} justifyContent="center" alignItems="center" mb={1}>
                <TrophyIcon color="warning" />
                <Typography variant="h6" color="primary">
                  Winner: {currentSubmission.score === 0 ? 'Draw': currentSubmission.score > 0 ? 'You' : 'System'}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Final Score — {currentSubmission.score}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Frames: {gameState.steps.length}
              </Typography>
            </Box>
          )}

          {error && (
            <Typography color="error" sx={{ mb: 3 }}>
              {error}
            </Typography>
          )}

          {/* Game panel (canvas only, no text) */}
          <Box
            sx={{
              width: canvasWidth,
              height: canvasHeight,
              bgcolor: 'background.paper',
              borderRadius: 3,
              mb: 4,
              position: 'relative',
              overflow: 'hidden',
              border: '2px solid #1976d2',
              boxShadow: '0 2px 12px 0 rgba(30,136,229,0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {loading ? (
              <CircularProgress />
            ) : gameState?.steps && gameState.steps.length > 0 ? (
              <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                style={{ background: colors.background }}
              />
            ) : (
              <Typography variant="h6" color="text.secondary">
                No game data available
              </Typography>
            )}
          </Box>

          {/* Controls */}
          {gameState?.steps && gameState.steps.length > 0 && (
            <>
              <Stack direction="row" spacing={2} justifyContent="center" alignItems="center" mb={2}>
                <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
                  <IconButton
                    color={isPlaying ? 'warning' : 'primary'}
                    onClick={handlePlayPause}
                    size="large"
                    sx={{
                      bgcolor: isPlaying ? 'warning.light' : 'primary.main',
                      color: isPlaying ? 'warning.contrastText' : 'common.white',
                      '&:hover': {
                        bgcolor: isPlaying ? 'warning.dark' : 'primary.dark',
                      },
                      width: 56,
                      height: 56,
                      fontSize: 32,
                    }}
                  >
                    {isPlaying ? <PauseIcon fontSize="inherit" /> : <PlayIcon fontSize="inherit" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Restart">
                  <IconButton
                    color="secondary"
                    onClick={handleRestart}
                    size="large"
                    sx={{
                      bgcolor: 'secondary.light',
                      color: 'common.white',
                      '&:hover': { bgcolor: 'secondary.dark' },
                      width: 48,
                      height: 48,
                      fontSize: 28,
                    }}
                  >
                    <ReplayIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Change Speed">
                  <IconButton
                    color="info"
                    onClick={handleSpeedChange}
                    size="large"
                    sx={{
                      bgcolor: 'info.light',
                      color: 'common.white',
                      '&:hover': { bgcolor: 'info.dark' },
                      width: 48,
                      height: 48,
                      fontSize: 28,
                    }}
                  >
                    <SpeedIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 70, ml: 1 }}>
                  Speed: <b>{playbackSpeed}x</b>
                </Typography>
              </Stack>
              <Box sx={{ mx: 4, width: canvasWidth }}>
                <Slider
                  value={step}
                  onChange={handleSeek}
                  min={0}
                  max={gameState.steps.length - 1}
                  aria-label="Seek"
                />
              </Box>
              <Typography variant="body2" mt={1} align="center" color="text.secondary">
                Frame: {step + 1} / {gameState.steps.length}
              </Typography>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

 export default GamePreview;