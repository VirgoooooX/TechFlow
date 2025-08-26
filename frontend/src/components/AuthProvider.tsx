import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, CircularProgress } from '@mui/material';
import { RootState } from '../store/index';
import { loginSuccess, loginFailure, clearAuth } from '../store/slices/authSlice';
import { authApi } from '../services/api';

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useDispatch();
  const { token, isLoading } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🔐 AuthProvider: 开始初始化认证状态');
      const storedToken = localStorage.getItem('token');
      console.log('🔐 AuthProvider: localStorage token:', storedToken ? storedToken.substring(0, 20) + '...' : 'null');
      
      if (!storedToken) {
        // 没有token，清除认证状态
        console.log('🔐 AuthProvider: 没有token，清除认证状态');
        dispatch(clearAuth());
        return;
      }

      try {
        // 验证token有效性
        console.log('🔐 AuthProvider: 开始验证token');
        const response = await authApi.verifyToken();
        console.log('🔐 AuthProvider: token验证响应:', response);
        
        if (response.success && response.data.user) {
          // token有效，恢复用户状态
          console.log('🔐 AuthProvider: token有效，恢复用户状态:', response.data.user);
          dispatch(loginSuccess({ 
            user: response.data.user, 
            token: storedToken 
          }));
        } else {
          // token无效，清除状态
          console.log('🔐 AuthProvider: token无效，清除状态');
          dispatch(loginFailure());
        }
      } catch (error) {
        // 验证失败，清除状态
        console.error('🔐 AuthProvider: Token verification failed:', error);
        dispatch(loginFailure());
      }
    };

    // 只在应用初始化时验证token
    if (isLoading) {
      console.log('🔐 AuthProvider: isLoading=true，开始初始化');
      initializeAuth();
    } else {
      console.log('🔐 AuthProvider: isLoading=false，跳过初始化');
    }
  }, [dispatch, isLoading]);

  // 显示加载状态
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: 'background.default'
        }}
      >
        <CircularProgress size={40} />
      </Box>
    );
  }

  return <>{children}</>;
};

export default AuthProvider;