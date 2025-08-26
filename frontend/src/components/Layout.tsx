import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  BookmarkBorder as BookmarkIcon,
  Article as ArticleIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/index';
import { logout as logoutAction } from '../store/slices/authSlice';
import MobileDock from './MobileDock';

const Layout: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // 检查是否为登录或注册页面
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const menuItems = [
    { text: '文章', icon: <ArticleIcon />, path: '/' },
  ];

  const userMenuItems = user ? [
    { text: '单词本', icon: <BookmarkIcon />, path: '/vocabulary' },
    { text: '设置', icon: <SettingsIcon />, path: '/settings' },
  ] : [];

  const drawer = (
    <Box sx={{ width: 250 }}>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleNavigation('/')}>
          <img 
            src="/logo.svg" 
            alt="TechFlow Logo" 
            style={{ height: '80px', width: 'auto' }}
          />
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem
            button
            key={item.text}
            onClick={() => handleNavigation(item.path)}
            selected={location.pathname === item.path}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
        {user && (
          <>
            <Divider sx={{ my: 1 }} />
            {userMenuItems.map((item) => (
              <ListItem
                button
                key={item.text}
                onClick={() => handleNavigation(item.path)}
                selected={location.pathname === item.path}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItem>
            ))}
          </>
        )}
      </List>
    </Box>
  );

  // 如果是登录或注册页面，只渲染主内容区域
  if (isAuthPage) {
    return (
      <Box sx={{ display: 'flex' }}>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: '100%'
          }}
        >
          <Outlet />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex' }}>
      
      {/* 侧边栏 */}
      <Box
        component="nav"
        sx={{ width: { md: 250 }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
            disableAutoFocus: true,
            disableEnforceFocus: true,
            disableRestoreFocus: true
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 250 },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 250 },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      {/* 主内容区域 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 0, md: 3 },
          width: { md: `calc(100% - 250px)` },
          mb: { xs: user ? '64px' : 0, md: 0 } // 移动端为底部dock栏留出空间
        }}
      >
        <Outlet />
      </Box>
      
      {/* 移动端底部导航栏 */}
      <MobileDock />
    </Box>
  );
};

export default Layout;