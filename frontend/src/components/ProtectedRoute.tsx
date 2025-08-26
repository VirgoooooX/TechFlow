import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Box, CircularProgress } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // 如果正在加载认证状态，显示加载指示器
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // 如果用户未登录，重定向到登录页面
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 用户已登录，渲染子组件
  return <>{children}</>;
};

export default ProtectedRoute;