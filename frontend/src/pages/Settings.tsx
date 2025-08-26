import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,

  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Tooltip,
  Paper,
  CircularProgress,
  Avatar,
  Divider,
  Collapse
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Science as TestIcon,
  Settings as SettingsIcon,
  Language as LanguageIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  RssFeed as RssIcon,
  Person as PersonIcon,
  BookmarkBorder as BookmarkIcon,
  Logout as LogoutIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  AdminPanelSettings as AdminIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { userApi, articlesApi, systemApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useFontSize } from '../contexts/FontSizeContext';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout as logoutAction } from '../store/slices/authSlice';
import { isAdmin } from '../utils/auth';

interface UserSettings {
  language: string;
  theme: string;
  fontSize: string;
  autoTranslate: boolean;
  showPhonetic: boolean;
  enableNotifications: boolean;
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl?: string;
  translationLanguage: string;
}

interface SystemSettings {
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl?: string;
  maxTokens: number;
  temperature: number;
  autoTranslate: boolean;
}

interface NewsSource {
  id: number;
  name: string;
  url: string;
  category: string;
  type?: string;
  isDefault: boolean;
  isActive: boolean;
  subscribed?: boolean;
}



const Settings: React.FC = () => {
  const { user, isLoading } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const { fontSize, setFontSize } = useFontSize();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  
  // 折叠状态管理
  const [expandedCards, setExpandedCards] = useState<{[key: string]: boolean}>({
    basic: false,
    llm: false,
    news: false,
    notifications: false,
    account: false,
    system: false
  });
  
  // 判断是否为管理员
  const userIsAdmin = isAdmin(user);
  
  const toggleCard = (cardKey: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardKey]: !prev[cardKey]
    }));
  };

  const [newSource, setNewSource] = useState({ name: '', url: '', category: '', sourceType: 'rss', contentType: 'media' });
  
  // 本地设置状态，用于实时显示用户输入
  const [localSettings, setLocalSettings] = useState<Partial<UserSettings>>({});
  
  // 系统设置本地状态
  const [localSystemSettings, setLocalSystemSettings] = useState<Partial<SystemSettings>>({});

  // 获取用户设置
  const {
    data: settings,

  } = useQuery({
    queryKey: ['user-settings'],
    queryFn: async (): Promise<UserSettings> => {
      const response = await userApi.getSettings();
      return response.data.settings;
    },
    enabled: !!user
  });

  // 获取系统设置（仅管理员可见）
  const {
    data: systemSettings,
    isLoading: systemSettingsLoading
  } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async (): Promise<SystemSettings> => {
      const response = await systemApi.getSettings();
      return response.data;
    },
    enabled: !!user && userIsAdmin
  });

  // 同步服务器数据到本地状态
  React.useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);
  
  // 同步系统设置到本地状态
  React.useEffect(() => {
    if (systemSettings) {
      setLocalSystemSettings(systemSettings);
    }
  }, [systemSettings]);



  // 获取新闻源
  const {
    data: newsSourcesData,
    isLoading: sourcesLoading
  } = useQuery({
    queryKey: ['news-sources'],
    queryFn: async () => {
      const response = await userApi.getNewsSources();
      return response.data;
    },
    enabled: !!user, // 确保用户已登录
    staleTime: 5 * 60 * 1000, // 5分钟
    refetchOnWindowFocus: false, // 禁用窗口焦点时重新获取
    refetchOnMount: true, // 组件挂载时重新获取
  });

  // 合并默认新闻源和用户自定义新闻源
  const newsSources: NewsSource[] = React.useMemo(() => {
    if (!newsSourcesData) return [];
    
    const defaultSources = (newsSourcesData.defaultSources || []).map((source: any): NewsSource => ({
      ...source,
      subscribed: source.subscribed,
      category: source.type || 'Technology'
    }));
    
    const userSources = (newsSourcesData.userSources || []).map((source: any): NewsSource => ({
      ...source,
      subscribed: true,
      category: source.type || 'Technology'
    }));
    
    return [...defaultSources, ...userSources];
  }, [newsSourcesData]);

  // 更新设置
  const { mutate: updateSettings } = useMutation({
    mutationFn: (data: Partial<UserSettings>) => userApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      setSnackbarMessage('设置已保存');
      setSnackbarOpen(true);
    },
    onError: () => {
      setSnackbarMessage('保存设置失败');
      setSnackbarOpen(true);
    }
  });
  
  // 更新系统设置
  const { mutate: updateSystemSettings } = useMutation({
    mutationFn: (data: Partial<SystemSettings>) => systemApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      setSnackbarMessage('系统设置已保存');
      setSnackbarOpen(true);
    },
    onError: () => {
      setSnackbarMessage('保存系统设置失败');
      setSnackbarOpen(true);
    }
  });

  // 防抖保存设置
  const debouncedSave = React.useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (key: keyof UserSettings, value: any) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        updateSettings({ [key]: value });
      }, 1000); // 1秒后保存
    };
  }, [updateSettings]);
  
  // 防抖保存系统设置
  const debouncedSaveSystem = React.useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (key: keyof SystemSettings, value: any) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        updateSystemSettings({ [key]: value });
      }, 1000); // 1秒后保存
    };
  }, [updateSystemSettings]);

  // 测试LLM配置
  const { mutate: testLLM, isPending: isTesting } = useMutation({
    mutationFn: (config: { provider: string; apiKey: string; model: string; baseUrl?: string }) =>
      userApi.testLLM(config),
    onSuccess: () => {
      setSnackbarMessage('LLM配置测试成功');
      setSnackbarOpen(true);
      setTestDialogOpen(false);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'LLM配置测试失败';
      setSnackbarMessage(message);
      setSnackbarOpen(true);
    }
  });

  // 添加新闻源
  const { mutate: addNewsSource, isPending: isAddingSource } = useMutation({
    mutationFn: (data: { name: string; url: string; category: string; sourceType: string; contentType: string }) =>
      userApi.addNewsSource({
        name: data.name,
        url: data.url,
        sourceType: data.sourceType,
        contentType: data.contentType,
        description: `分类: ${data.category}`
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-sources'] });
      setSnackbarMessage('新闻源已添加');
      setSnackbarOpen(true);
      setSourceDialogOpen(false);
      setNewSource({ name: '', url: '', category: '', sourceType: 'rss', contentType: 'media' });
    },
    onError: () => {
      setSnackbarMessage('添加新闻源失败');
      setSnackbarOpen(true);
    }
  });

  // 更新新闻源订阅
  const { mutate: toggleSubscription } = useMutation({
    mutationFn: ({ id, isEnabled }: { id: number; isEnabled: boolean }) =>
      userApi.toggleSubscription(id.toString(), isEnabled),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['news-sources'] });
      setSnackbarMessage(variables.isEnabled ? '新闻源已启用' : '新闻源已禁用');
      setSnackbarOpen(true);
    },
    onError: (error) => {
      console.error('Toggle subscription error:', error);
      setSnackbarMessage('操作失败，请重试');
      setSnackbarOpen(true);
    }
  });

  // 删除新闻源
  const { mutate: deleteNewsSource } = useMutation({
    mutationFn: (id: number) => userApi.deleteNewsSource(id.toString()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-sources'] });
      setSnackbarMessage('新闻源已删除');
      setSnackbarOpen(true);
    },
    onError: () => {
      setSnackbarMessage('删除新闻源失败');
      setSnackbarOpen(true);
    }
  });

  // 手动刷新新闻
  const { mutate: refreshNews, isPending: isRefreshing } = useMutation({
    mutationFn: () => articlesApi.refreshNews(),
    onSuccess: (data) => {
      setSnackbarMessage(`刷新完成！获取了 ${data.data.totalArticles} 篇新文章`);
      setSnackbarOpen(true);
      // 刷新文章列表
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
    onError: () => {
      setSnackbarMessage('刷新新闻失败，请重试');
      setSnackbarOpen(true);
    }
  });

  const handleSettingChange = (key: keyof UserSettings, value: any) => {
    // 立即更新本地状态以实现实时显示
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    
    // 特殊处理主题切换
    if (key === 'theme') {
      setThemeMode(value as 'light' | 'dark' | 'auto');
    }
    
    // 特殊处理字号调整
    if (key === 'fontSize') {
      setFontSize(value as 'small' | 'medium' | 'large');
    }
    
    // 防抖保存到服务器
    debouncedSave(key, value);
  };

  const handleSystemSettingChange = (key: keyof SystemSettings, value: any) => {
    setLocalSystemSettings(prev => ({ ...prev, [key]: value }));
    debouncedSaveSystem(key, value);
  };

  const handleLogout = () => {
    dispatch(logoutAction());
    navigate('/login');
  };

  const handleTestLLM = () => {
    const currentSettings = { ...settings, ...localSettings };
    if (!currentSettings.llmApiKey) return;
    testLLM({
      provider: currentSettings.llmProvider || 'openai',
      apiKey: currentSettings.llmApiKey,
      model: currentSettings.llmModel || 'gpt-3.5-turbo',
      baseUrl: currentSettings.llmBaseUrl
    });
  };

  // 获取模型名称占位符
  const getModelPlaceholder = (provider: string | undefined) => {
    switch (provider) {
      case 'openai':
        return '例如: gpt-3.5-turbo, gpt-4, gpt-4-turbo';
      case 'anthropic':
        return '例如: claude-3-sonnet-20240229, claude-3-haiku-20240307';
      case 'gemini':
        return '例如: gemini-pro, gemini-pro-vision';
      case 'qianwen':
        return '例如: qwen-turbo, qwen-plus, qwen-max';
      case 'ernie':
        return '例如: ernie-bot, ernie-bot-turbo';
      case 'glm':
        return '例如: glm-4, glm-3-turbo';
      case 'custom':
        return '例如: gpt-3.5-turbo, claude-3-sonnet (取决于API提供商)';
      default:
        return '例如: gpt-3.5-turbo';
    }
  };

  // 获取模型配置帮助文本
  const getModelHelperText = (provider: string | undefined) => {
    switch (provider) {
      case 'openai':
        return 'OpenAI模型，推荐使用gpt-3.5-turbo或gpt-4';
      case 'anthropic':
        return 'Claude模型，推荐使用claude-3-sonnet或claude-3-haiku';
      case 'gemini':
        return 'Google Gemini模型，推荐使用gemini-pro';
      case 'qianwen':
        return '阿里通义千问模型，推荐使用qwen-turbo';
      case 'ernie':
        return '百度文心一言模型，推荐使用ernie-bot';
      case 'glm':
        return '智谱GLM模型，推荐使用glm-4';
      case 'custom':
        return '符合OpenAI规范的自定义API模型名称，如gpt-3.5-turbo等';
      default:
        return '';
    }
  };

  // 获取API密钥帮助文本
  const getApiKeyHelperText = (provider: string | undefined) => {
    switch (provider) {
      case 'openai':
        return '在 platform.openai.com 获取API密钥，您的密钥将被安全存储';
      case 'anthropic':
        return '在 console.anthropic.com 获取API密钥，您的密钥将被安全存储';
      case 'gemini':
        return '在 makersuite.google.com 获取API密钥，您的密钥将被安全存储';
      case 'qianwen':
        return '在阿里云控制台获取API密钥，您的密钥将被安全存储';
      case 'ernie':
        return '在百度智能云控制台获取API密钥，您的密钥将被安全存储';
      case 'glm':
        return '在智谱AI开放平台获取API密钥，您的密钥将被安全存储';
      case 'custom':
        return '请输入符合OpenAI规范的自定义API密钥，您的密钥将被安全存储';
      default:
        return '您的API密钥将被安全存储';
    }
  };

  if (!user) {
    return (
      <Container maxWidth={false} sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: { xs: '100%', md: '1200px' }, mx: 'auto' }}>
        <Alert severity="warning">
          请先登录以访问设置页面
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: { xs: '100%', md: '1200px' }, mx: 'auto' }}>


      {/* 用户信息 - 顶部显示 */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Avatar sx={{ width: 80, height: 80, mr: 3, bgcolor: 'primary.main', fontSize: '2rem' }}>
          {user?.username?.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ mb: 1 }}>{user?.username}</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {user?.email}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<BookmarkIcon />}
              onClick={() => navigate('/vocabulary')}
              size="small"
            >
              生词本
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              size="small"
            >
              退出登录
            </Button>
          </Box>
        </Box>
      </Box>

      {/* 设置项 - 竖向排布 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* 基本设置 */}
        <Card>
          <CardContent>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                mb: expandedCards.basic ? 3 : 0
              }}
              onClick={() => toggleCard('basic')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SettingsIcon sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6">基本设置</Typography>
              </Box>
              <IconButton 
                sx={{ 
                  transform: expandedCards.basic ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s'
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Box>
            <Collapse in={expandedCards.basic}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                  界面设置
                </Typography>
                <Box sx={{ mb: 3 }}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>主题</InputLabel>
                    <Select
                      value={themeMode}
                      label="主题"
                      onChange={(e) => handleSettingChange('theme', e.target.value)}
                    >
                      <MenuItem value="light">浅色</MenuItem>
                      <MenuItem value="dark">深色</MenuItem>
                      <MenuItem value="auto">跟随系统</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>字号大小</InputLabel>
                    <Select
                      value={fontSize}
                      label="字号大小"
                      onChange={(e) => handleSettingChange('fontSize', e.target.value)}
                    >
                      <MenuItem value="small">小</MenuItem>
                      <MenuItem value="medium">标准</MenuItem>
                      <MenuItem value="large">大</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                  阅读设置
                </Typography>
                <Box sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localSettings?.autoTranslate ?? settings?.autoTranslate ?? false}
                        onChange={(e) => handleSettingChange('autoTranslate', e.target.checked)}
                      />
                    }
                    label="自动翻译标题"
                    sx={{ mb: 2, display: 'block' }}
                  />
                </Box>
              </Grid>
            </Grid>
            </Collapse>
          </CardContent>
        </Card>

        {/* LLM配置 */}
        <Card>
          <CardContent>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                mb: expandedCards.llm ? 3 : 0
              }}
              onClick={() => toggleCard('llm')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <LanguageIcon sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6">LLM配置</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title="测试LLM配置">
                  <span>
                    <IconButton
                      onClick={() => setTestDialogOpen(true)}
                      disabled={!(localSettings?.llmApiKey || settings?.llmApiKey)}
                      size="small"
                      sx={{ 
                        bgcolor: 'primary.main',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        '&:hover': {
                          bgcolor: 'primary.dark'
                        },
                        '&:disabled': {
                          bgcolor: 'action.disabled',
                          color: 'white'
                        }
                      }}
                    >
                      <TestIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <IconButton 
                  sx={{ 
                    transform: expandedCards.llm ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s'
                  }}
                >
                  <ExpandMoreIcon />
                </IconButton>
              </Box>
            </Box>
            <Collapse in={expandedCards.llm}>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>LLM提供商</InputLabel>
                  <Select
                    value={localSettings?.llmProvider || settings?.llmProvider || 'openai'}
                    label="LLM提供商"
                    onChange={(e) => handleSettingChange('llmProvider', e.target.value)}
                  >
                    <MenuItem value="openai">OpenAI</MenuItem>
                    <MenuItem value="anthropic">Anthropic (Claude)</MenuItem>
                    <MenuItem value="gemini">Google Gemini</MenuItem>
                    <MenuItem value="qianwen">阿里通义千问</MenuItem>
                    <MenuItem value="ernie">百度文心一言</MenuItem>
                    <MenuItem value="glm">智谱GLM</MenuItem>
                    <MenuItem value="custom">自定义API (OpenAI兼容)</MenuItem>
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    选择您要使用的AI服务提供商，支持多种主流LLM服务
                  </Typography>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="API密钥"
                  type="password"
                  value={localSettings?.llmApiKey || settings?.llmApiKey || ''}
                  onChange={(e) => handleSettingChange('llmApiKey', e.target.value)}
                  sx={{ mb: 2 }}
                  helperText={getApiKeyHelperText(localSettings?.llmProvider || settings?.llmProvider)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="模型名称"
                  value={localSettings?.llmModel || settings?.llmModel || ''}
                  onChange={(e) => handleSettingChange('llmModel', e.target.value)}
                  sx={{ mb: 2 }}
                  placeholder={getModelPlaceholder(localSettings?.llmProvider || settings?.llmProvider)}
                  helperText={getModelHelperText(localSettings?.llmProvider || settings?.llmProvider)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                {(localSettings?.llmProvider || settings?.llmProvider) === 'custom' ? (
                  <TextField
                    fullWidth
                    label="API基础URL"
                    value={localSettings?.llmBaseUrl || settings?.llmBaseUrl || ''}
                    onChange={(e) => handleSettingChange('llmBaseUrl', e.target.value)}
                    sx={{ mb: 2 }}
                    placeholder="例如: https://api.openai.com/v1 或 https://your-api.com/v1"
                    helperText="请输入符合OpenAI API规范的基础URL，包含/chat/completions端点"
                  />
                ) : (
                  <Box sx={{ height: '56px', display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {(localSettings?.llmProvider || settings?.llmProvider) !== 'custom' && '使用默认API端点'}
                    </Typography>
                  </Box>
                )}
              </Grid>
            </Grid>
            
            <Alert severity="info" sx={{ mt: 2 }}>
              LLM用于单词查询、句子翻译和文章摘要生成。请确保您的API密钥有足够的配额。
            </Alert>
            </Collapse>
          </CardContent>
        </Card>

        {/* 新闻源管理 */}
        <Card>
          <CardContent>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                mb: expandedCards.news ? 3 : 0
              }}
              onClick={() => toggleCard('news')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <RssIcon sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6">新闻源管理</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title={isRefreshing ? '刷新中...' : '刷新新闻'}>
                  <span>
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        refreshNews();
                      }}
                      disabled={isRefreshing}
                      size="small"
                      sx={{ 
                        bgcolor: 'primary.main',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        '&:hover': {
                          bgcolor: 'primary.dark'
                        },
                        '&:disabled': {
                          bgcolor: 'action.disabled',
                          color: 'white'
                        }
                      }}
                    >
                      <RefreshIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="添加新闻源">
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setSourceDialogOpen(true);
                    }}
                    size="small"
                    sx={{ 
                      bgcolor: 'primary.main',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      '&:hover': {
                        bgcolor: 'primary.dark'
                      }
                    }}
                  >
                    <AddIcon />
                  </IconButton>
                </Tooltip>
                <IconButton 
                  sx={{ 
                    transform: expandedCards.news ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s'
                  }}
                >
                  <ExpandMoreIcon />
                </IconButton>
              </Box>
            </Box>
            <Collapse in={expandedCards.news}>
            
            {sourcesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={2}>
                {newsSources?.map((source) => (
                  <Grid item xs={12} key={source.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ flexGrow: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Typography variant="h6" sx={{ mr: 2 }}>
                                {source.name}
                              </Typography>
                              <Chip
                                label={source.category}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                              {source.isDefault && (
                                <Chip
                                  label="默认"
                                  size="small"
                                  color="success"
                                  sx={{ ml: 1 }}
                                />
                              )}
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {source.url}
                            </Typography>
                            {source.isDefault && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                默认新闻源可以通过开关进行启用或禁用
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={source.subscribed || false}
                                  onChange={() => toggleSubscription({ id: source.id, isEnabled: !(source.subscribed || false) })}
                                />
                              }
                              label={source.isDefault ? "启用" : "订阅"}
                              sx={{ 
                                mr: 2,
                                '& .MuiFormControlLabel-label': {
                                  display: { xs: 'none', sm: 'block' }
                                }
                              }}
                            />
                            {!source.isDefault && (
                              <IconButton
                                color="error"
                                onClick={() => deleteNewsSource(source.id)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            )}
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
            </Collapse>
          </CardContent>
        </Card>

        {/* 通知设置 */}
        <Card>
          <CardContent>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                mb: expandedCards.notifications ? 3 : 0
              }}
              onClick={() => toggleCard('notifications')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <NotificationsIcon sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6">通知设置</Typography>
              </Box>
              <IconButton 
                sx={{ 
                  transform: expandedCards.notifications ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s'
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Box>
            <Collapse in={expandedCards.notifications}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings?.enableNotifications || false}
                  onChange={(e) => handleSettingChange('enableNotifications', e.target.checked)}
                />
              }
              label="启用通知"
              sx={{ mb: 2, display: 'block' }}
            />
            <Typography variant="body2" color="text.secondary">
              当有新文章或重要更新时接收通知
            </Typography>
            </Collapse>
          </CardContent>
        </Card>

        {/* 系统设置 - 仅管理员可见 */}
        {userIsAdmin && (
          <Card>
            <CardContent>
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  mb: expandedCards.system ? 3 : 0
                }}
                onClick={() => toggleCard('system')}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AdminIcon sx={{ mr: 2, color: 'primary.main' }} />
                  <Typography variant="h6">系统设置</Typography>
                  <Chip 
                    label="管理员" 
                    size="small" 
                    color="primary" 
                    sx={{ ml: 2 }} 
                  />
                </Box>
                <IconButton 
                  sx={{ 
                    transform: expandedCards.system ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s'
                  }}
                >
                  <ExpandMoreIcon />
                </IconButton>
              </Box>
              <Collapse in={expandedCards.system}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                      LLM 配置
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>LLM 提供商</InputLabel>
                          <Select
                            value={localSystemSettings?.llmProvider || 'openai'}
                            label="LLM 提供商"
                            onChange={(e) => handleSystemSettingChange('llmProvider', e.target.value)}
                          >
                            <MenuItem value="openai">OpenAI</MenuItem>
                            <MenuItem value="anthropic">Anthropic</MenuItem>
                            <MenuItem value="azure">Azure OpenAI</MenuItem>
                            <MenuItem value="custom">自定义</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="API 密钥"
                          type="password"
                          value={localSystemSettings?.llmApiKey || ''}
                          onChange={(e) => handleSystemSettingChange('llmApiKey', e.target.value)}
                          placeholder="输入系统 API 密钥"
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="模型名称"
                          value={localSystemSettings?.llmModel || 'gpt-3.5-turbo'}
                          onChange={(e) => handleSystemSettingChange('llmModel', e.target.value)}
                          placeholder="例如: gpt-3.5-turbo"
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Base URL (可选)"
                          value={localSystemSettings?.llmBaseUrl || ''}
                          onChange={(e) => handleSystemSettingChange('llmBaseUrl', e.target.value)}
                          placeholder="自定义 API 端点"
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="最大 Token 数"
                          type="number"
                          value={localSystemSettings?.maxTokens || 2000}
                          onChange={(e) => handleSystemSettingChange('maxTokens', parseInt(e.target.value))}
                          inputProps={{ min: 100, max: 8000 }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="温度参数"
                          type="number"
                          value={localSystemSettings?.temperature || 0.7}
                          onChange={(e) => handleSystemSettingChange('temperature', parseFloat(e.target.value))}
                          inputProps={{ min: 0, max: 2, step: 0.1 }}
                        />
                      </Grid>
                    </Grid>
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                      系统功能
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={localSystemSettings?.autoTranslate || false}
                          onChange={(e) => handleSystemSettingChange('autoTranslate', e.target.checked)}
                        />
                      }
                      label="全局自动翻译"
                      sx={{ mb: 2, display: 'block' }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      为所有用户启用自动翻译功能
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                      <Button
                        variant="outlined"
                        startIcon={<TestIcon />}
                        onClick={() => setTestDialogOpen(true)}
                        disabled={!localSystemSettings?.llmApiKey}
                      >
                        测试系统配置
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Collapse>
            </CardContent>
          </Card>
        )}

        {/* 账户设置 */}
        <Card>
          <CardContent>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                mb: expandedCards.account ? 3 : 0
              }}
              onClick={() => toggleCard('account')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SecurityIcon sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6">账户设置</Typography>
              </Box>
              <IconButton 
                sx={{ 
                  transform: expandedCards.account ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s'
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Box>
            <Collapse in={expandedCards.account}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                  账户信息
                </Typography>
                <Typography variant="body1" gutterBottom>
                  用户名: {user.username}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  邮箱: {user.email}
                </Typography>
                <Button variant="outlined" sx={{ mt: 2 }}>
                  修改密码
                </Button>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: 'error.main' }}>
                  危险操作
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  这些操作无法撤销，请谨慎操作
                </Typography>
                <Button variant="outlined" color="error" sx={{ mt: 2 }}>
                  删除账户
                </Button>
              </Grid>
            </Grid>
            </Collapse>
          </CardContent>
        </Card>
      </Box>

      {/* 测试LLM配置对话框 */}
      <Dialog 
        open={testDialogOpen} 
        onClose={() => setTestDialogOpen(false)}
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
      >
        <DialogTitle>测试LLM配置</DialogTitle>
        <DialogContent>
          <Typography>
            将发送一个测试请求来验证您的LLM配置是否正确。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>
            取消
          </Button>
          <Button
            variant="contained"
            onClick={handleTestLLM}
            disabled={isTesting}
          >
            {isTesting ? <CircularProgress size={20} /> : '开始测试'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 添加新闻源对话框 */}
      <Dialog
        open={sourceDialogOpen}
        onClose={() => setSourceDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
      >
        <DialogTitle>添加新闻源</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="名称"
            value={newSource.name}
            onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="RSS URL"
            value={newSource.url}
            onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>源类型</InputLabel>
            <Select
              value={newSource.sourceType}
              label="源类型"
              onChange={(e) => setNewSource({ ...newSource, sourceType: e.target.value })}
            >
              <MenuItem value="rss">RSS订阅源</MenuItem>
              <MenuItem value="api">API接口</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>内容类型</InputLabel>
            <Select
              value={newSource.contentType}
              label="内容类型"
              onChange={(e) => setNewSource({ ...newSource, contentType: e.target.value })}
            >
              <MenuItem value="media">图文内容 - 包含图片和富媒体</MenuItem>
              <MenuItem value="text">纯文字内容 - 仅保留文字</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>分类</InputLabel>
            <Select
              value={newSource.category}
              label="分类"
              onChange={(e) => setNewSource({ ...newSource, category: e.target.value })}
            >
              <MenuItem value="Technology">科技</MenuItem>
              <MenuItem value="Science">科学</MenuItem>
              <MenuItem value="Business">商业</MenuItem>
              <MenuItem value="AI">人工智能</MenuItem>
              <MenuItem value="Programming">编程</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSourceDialogOpen(false)}>
            取消
          </Button>
          <Button
            variant="contained"
            onClick={() => addNewsSource(newSource)}
            disabled={isAddingSource || !newSource.name || !newSource.url || !newSource.category || !newSource.sourceType || !newSource.contentType}
          >
            {isAddingSource ? <CircularProgress size={20} /> : '添加'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 消息提示 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Container>
  );
};

export default Settings;