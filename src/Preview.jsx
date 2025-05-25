import React, { useEffect, useRef, useState } from 'react';
import {
    Box, Container, Typography, Paper, Grid, Card, CardContent,
    IconButton, Tooltip, Stack, Slider, CircularProgress
} from '@mui/material';
import {
    PlayArrow as PlayIcon,
    Pause as PauseIcon,
    Replay as ReplayIcon,
    Speed as SpeedIcon,
    SportsEsports as GameIcon,
    EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import { getFunctions, httpsCallable } from 'firebase/functions';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Extend dayjs with the plugins
dayjs.extend(utc);
dayjs.extend(timezone);

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

const Preview = () => {
    const [matchesByRound, setMatchesByRound] = useState({});
    const [loading, setLoading] = useState(false);
    const [gameState, setGameState] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [step, setStep] = useState(0);
    const [currentMatch, setCurrentMatch] = useState(null);
    const intervalRef = useRef(null);
    const canvasRef = useRef(null);
    const functions = getFunctions();

    const fetchRound2Matches = async () => {
        try {
            setLoading(true);
            const fn = httpsCallable(functions, 'getRound2Matches');
            const result = await fn();

            if (!result.data || !result.data.success || !result.data.matches) {
                throw new Error("Invalid matches data returned from function");
            }

            const sortedArray = result.data.matches; // Already sorted array of { round, matches }

            // Convert to object if your frontend expects an object map of round -> matches
            const sortedGroupedMatches = {};
            for (const { round, matches } of sortedArray) {
                sortedGroupedMatches[round] = matches;
            }

            setMatchesByRound(sortedGroupedMatches);
        } catch (err) {
            console.error('Error fetching matches:', err);
        } finally {
            setLoading(false);
        }
    };



    const fetchGameState = async (matchId) => {
        try {
            setLoading(true);
            const fn = httpsCallable(functions, 'getGameState');
            const result = await fn({ roundResultId: matchId });
            setGameState(result.data);
            setStep(0);
        } catch (err) {
            console.error('Error fetching game state:', err);
        } finally {
            setLoading(false);
        }
    };

    const convertCsvDataToSteps = (csv) => {
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
        return {steps};
    }

    useEffect(() => {
        fetchRound2Matches();
    }, []);

    useEffect(() => {
        if (!gameState?.steps?.length) return;
        if (isPlaying) {
            intervalRef.current = setInterval(() => {
                setStep(prev => (prev + 1) % gameState.steps.length);
            }, 100 / playbackSpeed);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [isPlaying, gameState, playbackSpeed]);

    useEffect(() => {
        if (!gameState?.steps?.length) return;
        const context = canvasRef.current.getContext('2d');
        context.clearRect(0, 0, canvasWidth, canvasHeight);
        context.fillStyle = colors.background;
        context.fillRect(0, 0, canvasWidth, canvasHeight);
        context.strokeStyle = colors.grid;
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

        context.beginPath();
        context.arc(ballX + scale / 2 + 2, ballY - ballRadius + 2, ballRadius, 0, 2 * Math.PI);
        context.fillStyle = colors.shadow;
        context.fill();

        context.beginPath();
        context.arc(ballX + scale / 2, ballY - ballRadius, ballRadius, 0, 2 * Math.PI);
        context.fillStyle = colors.ball;
        context.shadowColor = colors.shadow;
        context.shadowBlur = 4;
        context.fill();
        context.shadowBlur = 0;

        context.fillStyle = colors.paddle1;
        context.beginPath();
        context.roundRect(paddle1X, paddle1Y, paddleWidth, paddleHeight, 8);
        context.fill();

        context.fillStyle = colors.paddle2;
        context.beginPath();
        context.roundRect(paddle2X, paddle2Y, paddleWidth, paddleHeight, 8);
        context.fill();

        context.font = 'bold 18px Roboto, Arial';
        context.textAlign = 'center';
        context.fillStyle = colors.paddle1;
        context.fillText('Team 1', paddle1X + paddleWidth / 2, canvasHeight - 8);
        context.fillStyle = colors.paddle2;
        context.fillText('Team 2', paddle2X + paddleWidth / 2, 24);
    }, [step, gameState]);

    const handlePlayPause = () => setIsPlaying(prev => !prev);
    const handleRestart = () => {
        setStep(0);
        setIsPlaying(false);
    };
    const handleSpeedChange = () => {
        const speeds = [1, 2, 4];
        const currentIndex = speeds.indexOf(playbackSpeed);
        setPlaybackSpeed(speeds[(currentIndex + 1) % speeds.length]);
    };

    return (
        <Box sx={{ py: 4 }}>
            <Container>
                <Typography variant="h4" gutterBottom>Round 2 Playoff Matches</Typography>
                {Object.entries(matchesByRound).map(([round, matches]) => (
                    <Box key={round} sx={{ mb: 4 }}>
                        <Grid container spacing={2}>
                            {matches.map((match) => (
                                <Grid item xs={12} sm={6} md={4} key={match.roundResultId}>
                                    <Card
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => {
                                            setCurrentMatch(match);
                                            setGameState(convertCsvDataToSteps(match.logCsv));
                                        }}
                                    >
                                        <CardContent>
                                            <Typography variant="body1">
                                                Team 1: {match.team1Name} — {match.team1Score}
                                            </Typography>
                                            <Typography variant="body1">
                                                Team 2: {match.team2Name} — {match.team2Score}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Round Id: {match.roundResultId}
                                            </Typography>
                                            <br/>
                                            <Typography variant="caption" color="text.secondary">
                                                Completed At: {dayjs(match.createdAt)
                                                .tz('Asia/Kolkata')
                                                .format('DD-MM-YYYY hh:mm A')}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                ))}

                {gameState && (
                    <Paper sx={{ mt: 4, p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <GameIcon sx={{ fontSize: 40, color: 'primary.main', mr: 1 }} />
                            <Typography variant="h5" color="primary.main">
                                Match Replay
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                width: canvasWidth,
                                height: canvasHeight,
                                mb: 2,
                                border: '2px solid #1976d2',
                                borderRadius: 2,
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                bgcolor: 'background.paper',
                            }}
                        >
                            {loading ? <CircularProgress /> : (
                                <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} />
                            )}
                        </Box>
                        <Stack direction="row" spacing={2} justifyContent="center" alignItems="center" mb={2}>
                            <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
                                <IconButton onClick={handlePlayPause}>
                                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Restart">
                                <IconButton onClick={handleRestart}>
                                    <ReplayIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Change Speed">
                                <IconButton onClick={handleSpeedChange}>
                                    <SpeedIcon />
                                </IconButton>
                            </Tooltip>
                            <Typography>Speed: {playbackSpeed}x</Typography>
                        </Stack>
                        <Slider
                            value={step}
                            onChange={(_, value) => setStep(value)}
                            min={0}
                            max={(gameState?.steps?.length || 1) - 1}
                        />
                        <Typography align="center" variant="body2">
                            Frame: {step + 1} / {gameState?.steps?.length}
                        </Typography>
                    </Paper>
                )}
            </Container>
        </Box>
    );
};

export default Preview;
