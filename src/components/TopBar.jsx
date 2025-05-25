import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Avatar,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Group as TeamIcon,
  Upload as UploadIcon,
  PlayArrow as PreviewIcon,
  Leaderboard as LeaderboardIcon,
  Menu as MenuIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';

const TopBar = ({ user }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const menuItems = [
    { title: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { title: 'Team', icon: <TeamIcon />, path: '/team' },
    { title: 'Upload', icon: <UploadIcon />, path: '/upload' },
    { title: 'Preview', icon: <PreviewIcon />, path: '/preview' },
    { title: 'Leaderboard', icon: <LeaderboardIcon />, path: '/leaderboard' },
    {title: 'Round2 Preview', icon: <PreviewIcon />, path: '/round2Preview'}
  ];

  const handleNavigation = (path) => {
    navigate(path);
    setDrawerOpen(false);
  };

  return (
    <AppBar position="static" sx={{ bgcolor: '#2196f3' }}>
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, cursor: 'pointer' }}
          onClick={() => navigate('/dashboard')}
        >
          Code Arena
        </Typography>

        {isMobile ? (
          <>
            <IconButton
              color="inherit"
              onClick={() => setDrawerOpen(true)}
              edge="end"
            >
              <MenuIcon />
            </IconButton>
            <Drawer
              anchor="right"
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
            >
              <List sx={{ width: 250 }}>
                <ListItem>
                  <ListItemIcon>
                    <Avatar
                      src={user?.photoURL || undefined}
                      alt={user?.displayName}
                      sx={{ width: 32, height: 32 }}
                    >
                      {user?.displayName ? user.displayName[0] : 'U'}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText primary={user?.displayName || 'User'} />
                </ListItem>
                {menuItems.map((item) => (
                  <ListItem
                    button
                    key={item.title}
                    onClick={() => handleNavigation(item.path)}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.title} />
                  </ListItem>
                ))}
                <ListItem button onClick={handleLogout}>
                  <ListItemIcon><LogoutIcon /></ListItemIcon>
                  <ListItemText primary="Logout" />
                </ListItem>
              </List>
            </Drawer>
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {menuItems.map((item) => (
              <Button
                key={item.title}
                color="inherit"
                startIcon={item.icon}
                onClick={() => navigate(item.path)}
                sx={{ 
                  '&:hover': { 
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                  }
                }}
              >
                {item.title}
              </Button>
            ))}

            <Avatar
              src={user?.photoURL || undefined}
              alt={user?.displayName}
              sx={{ width: 32, height: 32 }}
            >
              {user?.displayName ? user.displayName[0] : 'U'}
            </Avatar>
            <Typography variant="body1">
              {user?.displayName || 'User'}
            </Typography>
            <IconButton color="inherit" onClick={handleLogout}>
              <LogoutIcon />
            </IconButton>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default TopBar; 