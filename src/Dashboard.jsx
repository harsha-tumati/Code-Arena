import React from 'react';
import { Link } from 'react-router-dom';
import { auth } from './firebase';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  useTheme,
  Divider,
} from '@mui/material';
import {
  Group as TeamIcon,
  Upload as UploadIcon,
  PlayArrow as PreviewIcon,
  Leaderboard as LeaderboardIcon,
} from '@mui/icons-material';

const Dashboard = () => {
  const theme = useTheme();
  const user = auth.currentUser;

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const menuItems = [
    {
      title: 'Team Management',
      description: 'Create or join a team to start competing',
      icon: <TeamIcon sx={{ fontSize: 40 }} />,
      path: '/team',
      color: theme.palette.primary.main,
    },
    {
      title: 'Upload Bot',
      description: 'Submit your bot code for the competition',
      icon: <UploadIcon sx={{ fontSize: 40 }} />,
      path: '/upload',
      color: theme.palette.secondary.main,
    },
    {
      title: 'Game Preview',
      description: 'Watch your bot in action',
      icon: <PreviewIcon sx={{ fontSize: 40 }} />,
      path: '/preview',
      color: theme.palette.success.main,
    },
    {
      title: 'Leaderboard',
      description: 'Check the current standings',
      icon: <LeaderboardIcon sx={{ fontSize: 40 }} />,
      path: '/leaderboard',
      color: theme.palette.warning.main,
    },
  ];

  return (
      <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Typography
              variant="h3"
              component="h1"
              gutterBottom
              sx={{
                textAlign: 'center',
                fontWeight: 'bold',
                color: 'text.primary',
                mb: 6,
              }}
          >
            Welcome to Code Arena
          </Typography>

          {/* Dashboard tiles */}
          <Grid container spacing={4}>
            {menuItems.map((item) => (
                <Grid item xs={12} sm={6} md={3} key={item.title}>
                  <Card
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'transform 0.2s',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                        },
                      }}
                  >
                    <CardActionArea
                        component={Link}
                        to={item.path}
                        sx={{ height: '100%' }}
                    >
                      <CardContent
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            p: 3,
                          }}
                      >
                        <Box
                            sx={{
                              width: 80,
                              height: 80,
                              borderRadius: '50%',
                              bgcolor: `${item.color}15`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              mb: 2,
                            }}
                        >
                          {React.cloneElement(item.icon, {
                            sx: { color: item.color },
                          })}
                        </Box>
                        <Typography
                            variant="h5"
                            component="h2"
                            gutterBottom
                            sx={{ fontWeight: 'bold' }}
                        >
                          {item.title}
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                        >
                          {item.description}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
            ))}
          </Grid>

          {/* Rules of the Game card */}
          <Card sx={{ maxWidth: 800, mt: 8, mx: 'auto' }}>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Rules of the Game
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1" paragraph>
                <strong>1. User Accounts:</strong><br />
                - Each user must only register once (no duplicate accounts)<br />
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>2. Teams:</strong><br />
                - Teams must have between 1 and 3 members<br />
                - Each user can only belong to one team at a time<br />
                - Team names must be unique<br />
                - Team creation is permanent (no name changes after creation)
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>3. Round 1: System Bot Challenges:</strong><br />
                - All teams compete against system-provided bots<br />
                - Scoring system: positive indicates win and negative indicates loss<br />
                - Leaderboard contains the info of the best submission only<br/>
                - Leaderboard is updated automatically after each successful submission<br />
                - Leaderboard is publicly visible to all users
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>4. Round 2: Top 16 Playoffs:</strong><br />
                - Only the top 16 teams from Round 1 qualify<br />
                - Teams compete against each other's bots in automated matches<br />
                - All match results are logged and publicly visible<br />
                - Final leaderboard determines the overall winners
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>5. Script Submission:</strong><br />
                - Only team members can submit bot scripts<br />
                - Submission methods:<br />
                &nbsp;&nbsp;&nbsp;&nbsp;• File upload (only .py file)<br />
                &nbsp;&nbsp;&nbsp;&nbsp;• In-app code editor <br />
                - Submission limits:<br />
                &nbsp;&nbsp;&nbsp;&nbsp;• 5 submissions per team per hour
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>6. Script Management:</strong><br />
                - Teams can view their previous submissions<br />
                - Teams can edit and resubmit previous code via the in-app editor<br />
                - Only the most recent submission is active for competition
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>7. Bot Evaluation:</strong><br />
                - Submitted bots are automatically run against system bots<br />
                - Results are displayed to the submitting team<br />
                - Leaderboard updates automatically after evaluation<br />
                - Evaluation may be delayed during peak times
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>8. Simulation Viewing:</strong><br />
                - Users can request to view simulations of their matches<br />
                - Simulations are rendered client-side using match logs<br />
                - Simulations show the bot's performance visually
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>9. Additional Rules:</strong><br />
                - All decisions by the admin are final<br />
              </Typography>
            </CardContent>
          </Card>
        </Container>
      </Box>
  );
};

export default Dashboard;
