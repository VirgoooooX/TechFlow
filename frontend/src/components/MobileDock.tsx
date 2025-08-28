import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Article as ArticleIcon,
  BookmarkBorder as BookmarkIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../store/index';

const MobileDock: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const user = useSelector((state: RootState) => state.auth.user);

  // 如果不是移动端或用户未登录，不显示dock
  if (!isMobile || !user) {
    return null;
  }

  const getCurrentValue = () => {
    const path = location.pathname;
    if (path === '/') return 0;
    if (path === '/vocabulary') return 1;
    if (path === '/settings') return 2;
    return 0; // 默认选中文章
  };

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    switch (newValue) {
      case 0:
        navigate('/');
        break;
      case 1:
        navigate('/vocabulary');
        break;
      case 2:
        navigate('/settings');
        break;
    }
  };

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: theme.zIndex.appBar,
        borderTop: `1px solid ${theme.palette.divider}`,
      }}
      elevation={8}
    >
      <BottomNavigation
        value={getCurrentValue()}
        onChange={handleChange}
        showLabels
        sx={{
          height: 64,
          minHeight: 64,
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
            padding: '8px 12px',
            minHeight: 'auto',
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.75rem',
            marginTop: '2px',
            opacity: '1 !important',
            transform: 'none !important',
          },
        }}
      >
        <BottomNavigationAction
          label="文章"
          icon={<ArticleIcon />}
          sx={{
            color: getCurrentValue() === 0 ? theme.palette.primary.main : theme.palette.text.secondary,
          }}
        />
        <BottomNavigationAction
          label="单词本"
          icon={<BookmarkIcon />}
          sx={{
            color: getCurrentValue() === 1 ? theme.palette.primary.main : theme.palette.text.secondary,
          }}
        />
        <BottomNavigationAction
          label="设置"
          icon={<SettingsIcon />}
          sx={{
            color: getCurrentValue() === 2 ? theme.palette.primary.main : theme.palette.text.secondary,
          }}
        />
      </BottomNavigation>
    </Paper>
  );
};

export default MobileDock;