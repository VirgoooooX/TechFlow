import { useSelector, useDispatch } from 'react-redux';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RootState } from '../store/index';
import { loginSuccess, loginFailure, logout } from '../store/slices/authSlice';
import { authApi } from '../services/api';

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, token, isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);

  // 登录
  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (response) => {
      dispatch(loginSuccess({ user: response.data.user, token: response.data.token }));
    },
    onError: () => {
      dispatch(loginFailure());
    },
  });

  // 注册
  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (response) => {
      dispatch(loginSuccess({ user: response.data.user, token: response.data.token }));
    },
    onError: () => {
      dispatch(loginFailure());
    },
  });

  // 登出
  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      dispatch(logout());
    },
  });

  // Token验证逻辑已移至AuthProvider组件中

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
  };
};