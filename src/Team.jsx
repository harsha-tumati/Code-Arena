import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from './firebase';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  useTheme,
  Autocomplete,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from '@mui/material';
import {
  Group as TeamIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

const Team = () => {
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userTeam, setUserTeam] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const functions = getFunctions();
  const theme = useTheme();

  useEffect(() => {
    fetchUserTeam();
  }, []);

  const fetchUserTeam = async () => {
    setLoading(true);
    try {
      const getUserTeamFn = httpsCallable(functions, 'getUserTeam');
      const result = await getUserTeamFn();
      setUserTeam(result.data);
    } catch (error) {
      console.error('Error fetching user team:', error);
      setError(error.message || 'Failed to fetch team information');
    } finally {
      setLoading(false);
    }
  };

  const searchTeams = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchTeamsFn = httpsCallable(functions, 'searchTeams');
      const result = await searchTeamsFn({ query: query.trim() });
      setSearchResults(result.data);
    } catch (error) {
      console.error('Error searching teams:', error);
      setError(error.message || 'Failed to search teams');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (event, newValue) => {
    setSearchQuery(newValue);
    searchTeams(newValue);
  };

  const createTeam = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!teamName.trim()) {
      setError('Please enter a team name');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setLoading(true);

    try {
      const createTeamFn = httpsCallable(functions, 'createTeam');
      await createTeamFn({ teamName: teamName.trim() });
      await fetchUserTeam();
    } catch (error) {
      console.error('Error creating team:', error);
      setError(error.message || 'Failed to create team');
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const joinTeam = async (teamId) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError('');
    setLoading(true);

    try {
      const joinTeamFn = httpsCallable(functions, 'joinTeam');
      await joinTeamFn({ teamId });
      await fetchUserTeam();
    } catch (error) {
      console.error('Error joining team:', error);
      setError(error.message || 'Failed to join team');
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  if (loading && !userTeam) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (userTeam) {
    return (
      <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
        <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
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
                bgcolor: `${theme.palette.primary.main}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <TeamIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />
            </Box>

            <Typography variant="h4" component="h1" gutterBottom align="center">
              Your Team
            </Typography>

            <Box sx={{ width: '100%', mb: 3 }}>
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="h5" gutterBottom>
                  {userTeam.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Team ID: {userTeam.id}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Members: {userTeam.memberCount}
                </Typography>
              </Paper>
            </Box>

            <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
              <Typography variant="h6" gutterBottom>
                Team Members
              </Typography>
              {userTeam.members?.map((member) => (
                <ListItem key={member.id}>
                  <ListItemAvatar>
                    <Avatar src={member.photoURL || undefined} alt={member.displayName}>
                      {member.displayName ? member.displayName[0] : <PersonIcon />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={member.displayName}
                    secondary={member.isLeader ? 'Team Leader' : 'Member'}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
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
              bgcolor: `${theme.palette.primary.main}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <TeamIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />
          </Box>

          <Typography variant="h4" component="h1" gutterBottom align="center">
            Team Management
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={createTeam} sx={{ width: '100%', mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Create New Team
            </Typography>
            <TextField
              fullWidth
              label="Team Name"
              variant="outlined"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              margin="normal"
              required
              disabled={loading}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading || isSubmitting}
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Create Team'}
            </Button>
          </Box>

          <Divider sx={{ width: '100%', my: 3 }}>
            <Typography variant="body2" color="text.secondary">
              OR
            </Typography>
          </Divider>

          <Box sx={{ width: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Join Existing Team
            </Typography>
            <Autocomplete
              freeSolo
              options={searchResults}
              getOptionLabel={(option) => 
                typeof option === 'string' ? option : option.name
              }
              inputValue={searchQuery}
              onInputChange={handleSearchChange}
              loading={isSearching}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  label="Search Teams"
                  variant="outlined"
                  margin="normal"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {isSearching ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TeamIcon color="primary" />
                    <Box>
                      <Typography variant="body1">{option.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {option.memberCount} members
                      </Typography>
                    </Box>
                  </Box>
                </li>
              )}
              onChange={(event, newValue) => {
                if (newValue && typeof newValue !== 'string') {
                  joinTeam(newValue.id);
                }
              }}
            />
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Team;
