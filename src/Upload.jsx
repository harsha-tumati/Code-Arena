import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth } from './firebase';
import { CodeiumEditor } from '@codeium/react-code-editor';
import { getApp } from 'firebase/app';

import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Alert,
  CircularProgress,
  useTheme,
  Card,
  CardContent,
  Grid,
} from '@mui/material';

import {
  Upload as UploadIcon,
  Code as CodeIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Group as GroupIcon,
} from '@mui/icons-material';

const Upload = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentSubmission, setCurrentSubmission] = useState(null);
  const [isInTeam, setIsInTeam] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const functions = getFunctions(getApp());
  const storage = getStorage();
  const theme = useTheme();
  const [pastSubmissions, setPastSubmissions] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setInitialLoading(true);
      try {
        // Check if user in team
        const getUserTeamFn = httpsCallable(functions, 'getUserTeam');
        const teamResult = await getUserTeamFn();
        if (!isMounted) return;
        setIsInTeam(!!teamResult.data);

        // Fetch current submission
        const getSubmissionFn = httpsCallable(functions, 'getCurrentSubmission');
        const subResult = await getSubmissionFn();
        if (!isMounted) return;
        setCurrentSubmission(subResult.data || null);

        // Fetch all past team submissions
        const getTeamSubmissionsFn = httpsCallable(functions, 'getTeamSubmissions');
        const pastResult = await getTeamSubmissionsFn();
        //console.log('pastResult:', pastResult.data[0]);
        if (!isMounted) return;
        if (isMounted) setPastSubmissions(pastResult.data || []);

        // If submission exists, fetch code from storage
        if (subResult.data?.filePath) {
          const fileRef = ref(storage, subResult.data.filePath);
          const url = await getDownloadURL(fileRef);
          const response = await fetch(url);
          const text = await response.text();
          setCode(text);
        }
      } catch (e) {
        console.error(e);
        if (isMounted) setError('Failed to load submission or team info');
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    };

    load();

    return () => { isMounted = false; };
  }, [functions, storage]);
  const loadSubmissionCode = async (submission) => {
    console.log("Loading submission for uid:", submission.uid);
    try {
      console.log("Found submission:", submission);
      const fileRef = ref(storage, submission.filePath);
      const url = await getDownloadURL(fileRef);
      const response = await fetch(url);
      const text = await response.text();
      setCode(text);
    } catch (err) {
      console.error(err);
      setError('Failed to load selected submission code.');
    }
  };


  const handleFileChange = (e) => {
    setError('');
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.py')) {
      setError('Please select a valid Python (.py) file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      setCode(evt.target.result);
    };
    reader.readAsText(file);
  };

  // const handleDelete = async () => {
  //   if (!currentSubmission) return;
  //
  //   setLoading(true);
  //   setError('');
  //   try {
  //     const deleteSubmissionFn = httpsCallable(functions, 'deleteSubmission');
  //     await deleteSubmissionFn();
  //     setCurrentSubmission(null);
  //     setCode('');
  //   } catch (e) {
  //     setError('Failed to delete submission');
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !code.trim()) return;

    setSubmitting(true);
    setError('');
    setLoading(true);

    try {
      const fileBlob = new Blob([code], { type: 'text/x-python' });
      const fileName = `${auth.currentUser.uid}-${Date.now()}.py`;
      const filePath = `submissions/${fileName}`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, fileBlob, {
        customMetadata: { uid: auth.currentUser.uid },
      });

      const downloadURL = await getDownloadURL(storageRef);

      const runGameFn = httpsCallable(functions, 'runGame');
      const result = await runGameFn({ botUrl: downloadURL, fileName });
      result.data.filePath = filePath;

      setCurrentSubmission(result.data);
      navigate('/preview');
    } catch (e) {
      console.error(e);
      if (e.message && e.message.includes('limit')) {
        setError('Submission limit reached. Please try again later.');
      } else if (e.code === 'failed-precondition') {
        setError('You must be in a team to upload a bot.');
      } else {
        setError('Failed to upload and run game. Please try again.');
      }
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  if (initialLoading) {
    return (
        <Box
            sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}
        >
          <CircularProgress />
        </Box>
    );
  }

  if (!isInTeam) {
    return (
        <Container maxWidth="sm" sx={{ mt: 8 }}>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <GroupIcon sx={{ fontSize: 80, mb: 2 }} color="action" />
            <Typography variant="h6" gutterBottom>
              Join a Team First
            </Typography>
            <Typography>You need to be part of a team before uploading bots.</Typography>
            <Button variant="contained" sx={{ mt: 3 }} onClick={() => navigate('/team')}>
              Go to Teams
            </Button>
          </Paper>
        </Container>
    );
  }

  return (
      <Container maxWidth="md" sx={{ mt: 6, mb: 6 }}>
        <Paper sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
            <UploadIcon color="primary" sx={{ fontSize: 40 }} />
            <Typography variant="h4">Upload or Edit Your Bot</Typography>
          </Box>

          {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
          )}

          {currentSubmission && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Grid container justifyContent="space-between" alignItems="center">
                    <Grid item>
                      <Typography variant="subtitle1">
                        Previous submission score: {currentSubmission.score ?? 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Last updated: {new Date(currentSubmission.created).toLocaleString()}
                      </Typography>
                    </Grid>
                    {/*<Grid item>*/}
                    {/*  <Button*/}
                    {/*      variant="outlined"*/}
                    {/*      color="error"*/}
                    {/*      startIcon={<DeleteIcon />}*/}
                    {/*      onClick={handleDelete}*/}
                    {/*      disabled={loading}*/}
                    {/*  >*/}
                    {/*    Delete Submission*/}
                    {/*  </Button>*/}
                    {/*</Grid>*/}
                  </Grid>
                </CardContent>
              </Card>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <input
                accept=".py"
                type="file"
                id="file-upload"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={loading || submitting}
            />
            <label htmlFor="file-upload">
              <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CloudUploadIcon />}
                  disabled={loading || submitting}
                  sx={{ mb: 2 }}
              >
                Upload Python File
              </Button>
            </label>
            {pastSubmissions.length > 0 && (
                <Paper sx={{ p: 2, mb: 3 }}>
                  <Typography variant="h6" gutterBottom>Past Submissions</Typography>
                  <Grid container spacing={2}>
                    {pastSubmissions.map((sub) => (
                        <Grid item xs={12} sm={6} md={4} key={sub.uid}>
                          <Card
                              sx={{ cursor: 'pointer', ':hover': { boxShadow: 6 } }}
                              onClick={() => loadSubmissionCode(sub)}
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
            {}
            <Box sx={{ border: '1px solid #ddd', borderRadius: 1, mb: 3 }}>
              <CodeiumEditor
                  value={code}
                  language="python"
                  placeholder="Write your bot code here..."
                  onChange={setCode}
                  padding={15}
                  style={{
                    fontSize: 14,
                    fontFamily: '"Fira code", "Fira Mono", monospace',
                    minHeight: 400,
                    backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fff',
                  }}
                  disabled={loading || submitting}
              />
            </Box>

            <Button
                type="submit"
                variant="contained"
                startIcon={<CodeIcon />}
                disabled={loading || submitting || !code.trim()}
            >
              {loading || submitting ? 'Submitting...' : 'Submit Bot'}
            </Button>
          </Box>
        </Paper>
      </Container>
  );
};
export default Upload;