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
  CircularProgress,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
  Person as PersonIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../services/api';

interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

interface RegisterFormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  agreeToTerms?: string;
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState<RegisterForm>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  });
  const [errors, setErrors] = useState<RegisterFormErrors>({});

  // 注册mutation
  const { mutate: registerUser, isPending, error } = useMutation({
    mutationFn: (data: Omit<RegisterForm, 'confirmPassword' | 'agreeToTerms'>) => 
      authApi.register(data),
    onSuccess: (response) => {
      login(response.data.user, response.data.token);
      navigate('/', { replace: true });
    },
    onError: (error: Error) => {
      console.error('Registration failed:', error);
    }
  });

  const handleInputChange = (field: keyof RegisterForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = field === 'agreeToTerms' ? event.target.checked : event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: RegisterFormErrors = {};

    if (!formData.username) {
      newErrors.username = '请输入用户名';
    } else if (formData.username.length < 3) {
      newErrors.username = '用户名至少需要3个字符';
    } else if (formData.username.length > 20) {
      newErrors.username = '用户名不能超过20个字符';
    } else if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(formData.username)) {
      newErrors.username = '用户名只能包含字母、数字、下划线和中文';
    }

    if (!formData.email) {
      newErrors.email = '请输入邮箱地址';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    if (!formData.password) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码至少需要6个字符';
    } else if (formData.password.length > 50) {
      newErrors.password = '密码不能超过50个字符';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = '密码必须包含大小写字母和数字';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '请确认密码';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = '请同意服务条款和隐私政策';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    if (validateForm()) {
      const { confirmPassword, agreeToTerms, ...registerData } = formData;
      registerUser(registerData);
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const handleToggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(prev => !prev);
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
              src="/logo.svg" 
              alt="TechFlow Logo" 
              style={{ height: '60px', width: 'auto', marginBottom: '16px' }}
            />
            <Typography component="h1" variant="h4" gutterBottom>
              注册账户
            </Typography>
            <Typography variant="body1" color="text.secondary">
              加入TechFlow，开始您的智能阅读之旅
            </Typography>
          </Box>

          {/* 错误提示 */}
          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 3 }}>
              {(error as any)?.response?.data?.message || '注册失败，请稍后重试'}
            </Alert>
          )}

          {/* 注册表单 */}
          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
              fullWidth
              id="username"
              label="用户名"
              name="username"
              autoComplete="username"
              autoFocus
              value={formData.username}
              onChange={handleInputChange('username')}
              error={!!errors.username}
              helperText={errors.username}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="action" />
                  </InputAdornment>
                )
              }}
            />
            
            <TextField
              fullWidth
              id="email"
              label="邮箱地址"
              name="email"
              autoComplete="email"
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
              autoComplete="new-password"
              value={formData.password}
              onChange={handleInputChange('password')}
              error={!!errors.password}
              helperText={errors.password || '密码需包含大小写字母和数字，至少6个字符'}
              sx={{ mb: 2 }}
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
            
            <TextField
              fullWidth
              id="confirmPassword"
              label="确认密码"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleInputChange('confirmPassword')}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle confirm password visibility"
                      onClick={handleToggleConfirmPasswordVisibility}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            {/* 服务条款同意 */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.agreeToTerms}
                  onChange={handleInputChange('agreeToTerms')}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2">
                  我同意{' '}
                  <Link href="#" underline="hover">
                    服务条款
                  </Link>
                  {' '}和{' '}
                  <Link href="#" underline="hover">
                    隐私政策
                  </Link>
                </Typography>
              }
              sx={{ mb: 2, alignItems: 'flex-start' }}
            />
            
            {errors.agreeToTerms && (
              <Typography variant="body2" color="error" sx={{ mb: 2 }}>
                {errors.agreeToTerms}
              </Typography>
            )}

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
                  注册中...
                </>
              ) : (
                '注册账户'
              )}
            </Button>

            <Divider sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary">
                或
              </Typography>
            </Divider>

            {/* 登录链接 */}
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2">
                已有账户？{' '}
                <Link
                  component={RouterLink}
                  to="/login"
                  variant="body2"
                  sx={{ textDecoration: 'none' }}
                >
                  立即登录
                </Link>
              </Typography>
            </Box>
          </Box>

          {/* 注册优势 */}
          <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 1, width: '100%' }}>
            <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
              注册后您可以享受
            </Typography>
            <Typography variant="body2" align="center">
              • 个性化新闻推荐 • 智能单词查询 • 生词本管理
            </Typography>
            <Typography variant="body2" align="center">
              • 文章翻译助手 • 学习进度跟踪
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

export default Register;