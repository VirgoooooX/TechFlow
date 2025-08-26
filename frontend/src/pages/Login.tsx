import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  InputAdornment,
  IconButton,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
  Login as LoginIcon
} from '@mui/icons-material';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface LoginForm {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<Partial<LoginForm>>({});

  // 获取重定向路径
  const from = (location.state as any)?.from?.pathname || '/';

  // 使用useAuth hook的登录方法
  const { login: loginUser, isLoginLoading: isPending, loginError: error, isAuthenticated } = useAuth();

  // 监听登录成功状态
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleInputChange = (field: keyof LoginForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<LoginForm> = {};

    if (!formData.email) {
      newErrors.email = '请输入邮箱地址';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    if (!formData.password) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码至少需要6个字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    if (validateForm()) {
      loginUser(formData);
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  return (
    <Container component="main" maxWidth="sm" sx={{ px: { xs: 0, md: 3 } }}>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          py: 4
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          {/* Logo和标题 */}
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <img 
              src="/src/assets/logo.svg" 
              alt="TechFlow Logo" 
              style={{ height: '60px', width: 'auto', marginBottom: '16px' }}
            />
            <Typography variant="body1" color="text.secondary">
              登录您的账户
            </Typography>
          </Box>

          {/* 错误提示 */}
          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 3 }}>
              {(error as any)?.response?.data?.message || '登录失败，请检查您的凭据'}
            </Alert>
          )}

          {/* 登录表单 */}
          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
              fullWidth
              id="email"
              label="邮箱地址"
              name="email"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={handleInputChange('email')}
              error={!!errors.email}
              helperText={errors.email}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                )
              }}
            />
            
            <TextField
              fullWidth
              id="password"
              label="密码"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={formData.password}
              onChange={handleInputChange('password')}
              error={!!errors.password}
              helperText={errors.password}
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleTogglePasswordVisibility}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isPending}
              sx={{ mb: 3, py: 1.5 }}
            >
              {isPending ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </Button>

            <Divider sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary">
                或
              </Typography>
            </Divider>

            {/* 注册链接 */}
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2">
                还没有账户？{' '}
                <Link
                  component={RouterLink}
                  to="/register"
                  variant="body2"
                  sx={{ textDecoration: 'none' }}
                >
                  立即注册
                </Link>
              </Typography>
            </Box>

            {/* 忘记密码链接 */}
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Link
                component={RouterLink}
                to="/forgot-password"
                variant="body2"
                sx={{ textDecoration: 'none' }}
              >
                忘记密码？
              </Link>
            </Box>
          </Box>

          {/* 演示账户提示 */}
          <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 1, width: '100%' }}>
            <Typography variant="body2" color="text.secondary" align="center">
              演示账户
            </Typography>
            <Typography variant="body2" align="center" sx={{ mt: 1 }}>
              邮箱: demo@techflow.com
            </Typography>
            <Typography variant="body2" align="center">
              密码: demo123
            </Typography>
          </Box>
        </Paper>

        {/* 页脚 */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            © 2024 TechFlow. 智能英语阅读助手
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default Login;