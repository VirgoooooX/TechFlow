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
  Paper,
  CircularProgress,
  Divider,
  Collapse
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Science as TestIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { systemApi } from '../services/api';

interface SystemSettings {
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl?: string;
  maxTokens: number;
  temperature: number;
  autoTranslate: boolean;
}

const SystemSettings: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [testLoading, setTestLoading] = useState(false);
  
  // 折叠状态管理
  const [expandedCards, setExpandedCards] = useState<{[key: string]: boolean}>({
    llm: true,
    system: true
  });
  
  const toggleCard = (cardKey: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardKey]: !prev[cardKey]
    }));
  };

  // 本地设置状态
  const [localSettings, setLocalSettings] = useState<Partial<SystemSettings>>({});

  // 获取系统设置
  const {
    data: settings,
    isLoading,
    error
  } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async (): Promise<SystemSettings> => {
      const response = await systemApi.getSettings();
      return response.data;
    },
    enabled: !!user
  });

  // 同步服务器数据到本地状态
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // 更新系统设置
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<SystemSettings>) => {
      const response = await systemApi.updateSettings(newSettings);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      setSnackbarMessage('系统设置已保存');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    },
    onError: (error: any) => {
      setSnackbarMessage(error.response?.data?.message || '保存失败');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  });

  // 测试LLM配置
  const testLLMConfig = async () => {
    setTestLoading(true);
    try {
      const response = await systemApi.testLLMConfig();
      setTestResult(response.data.result || '测试成功！LLM配置正常工作。');
    } catch (error: any) {
      setTestResult(error.response?.data?.message || '测试失败，请检查配置');
    } finally {
      setTestLoading(false);
    }
  };

  const handleSettingChange = (key: keyof SystemSettings, value: any) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = () => {
    updateSettingsMutation.mutate(localSettings);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">
          加载系统设置失败，请检查您的权限或稍后重试。
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* 页面标题 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
          系统设置
        </Typography>
        <Typography variant="body1" color="text.secondary">
          配置系统级别的默认参数，这些设置将作为所有用户的默认配置。
        </Typography>
      </Box>

      {/* 设置项 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

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
                <SettingsIcon sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6">LLM配置</Typography>
              </Box>
              <IconButton 
                sx={{ 
                  transform: expandedCards.llm ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s'
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Box>
            <Collapse in={expandedCards.llm}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>LLM提供商</InputLabel>
                    <Select
                      value={localSettings?.llmProvider || ''}
                      label="LLM提供商"
                      onChange={(e) => handleSettingChange('llmProvider', e.target.value)}
                    >
                      <MenuItem value="openai">OpenAI</MenuItem>
                      <MenuItem value="anthropic">Anthropic</MenuItem>
                      <MenuItem value="gemini">Google Gemini</MenuItem>
                      <MenuItem value="qianwen">阿里千问</MenuItem>
                      <MenuItem value="ernie">百度文心</MenuItem>
                      <MenuItem value="glm">智谱GLM</MenuItem>
                      <MenuItem value="custom">自定义API</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <TextField
                    fullWidth
                    label="API密钥"
                    type="password"
                    value={localSettings?.llmApiKey || ''}
                    onChange={(e) => handleSettingChange('llmApiKey', e.target.value)}
                    sx={{ mb: 2 }}
                    helperText="用于调用LLM服务的API密钥"
                  />
                  
                  <TextField
                    fullWidth
                    label="模型名称"
                    value={localSettings?.llmModel || ''}
                    onChange={(e) => handleSettingChange('llmModel', e.target.value)}
                    sx={{ mb: 2 }}
                    helperText="例如：gpt-3.5-turbo, claude-3-sonnet-20240229"
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="API基础URL（可选）"
                    value={localSettings?.llmBaseUrl || ''}
                    onChange={(e) => handleSettingChange('llmBaseUrl', e.target.value)}
                    sx={{ mb: 2 }}
                    helperText="自定义API端点，留空使用默认"
                  />
                  
                  <TextField
                    fullWidth
                    label="最大Token数"
                    type="number"
                    value={localSettings?.maxTokens || 1000}
                    onChange={(e) => handleSettingChange('maxTokens', parseInt(e.target.value))}
                    sx={{ mb: 2 }}
                    inputProps={{ min: 100, max: 4000 }}
                    helperText="单次请求的最大Token数量"
                  />
                  
                  <TextField
                    fullWidth
                    label="温度参数"
                    type="number"
                    value={localSettings?.temperature || 0.7}
                    onChange={(e) => handleSettingChange('temperature', parseFloat(e.target.value))}
                    sx={{ mb: 2 }}
                    inputProps={{ min: 0, max: 2, step: 0.1 }}
                    helperText="控制输出的随机性，0-2之间"
                  />
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 3 }} />
              
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  startIcon={<TestIcon />}
                  onClick={() => setTestDialogOpen(true)}
                  disabled={!localSettings?.llmApiKey}
                >
                  测试配置
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? '保存中...' : '保存配置'}
                </Button>
              </Box>
            </Collapse>
          </CardContent>
        </Card>

        {/* 系统设置 */}
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
                <SettingsIcon sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6">系统设置</Typography>
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
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings?.autoTranslate || false}
                    onChange={(e) => handleSettingChange('autoTranslate', e.target.checked)}
                  />
                }
                label="系统级自动翻译"
                sx={{ mb: 2, display: 'block' }}
              />
              <Typography variant="body2" color="text.secondary">
                启用后，系统将在抓取新闻时自动翻译标题（如果没有用户特定设置）
              </Typography>
              
              <Divider sx={{ my: 3 }} />
              
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? '保存中...' : '保存设置'}
                </Button>
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      </Box>

      {/* 测试LLM配置对话框 */}
      <Dialog 
        open={testDialogOpen} 
        onClose={() => setTestDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>测试LLM配置</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            这将使用当前配置发送一个测试请求到LLM服务。
          </Typography>
          {testResult && (
            <Alert 
              severity={testResult.includes('成功') ? 'success' : 'error'} 
              sx={{ mt: 2 }}
            >
              {testResult}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>取消</Button>
          <Button 
            onClick={testLLMConfig} 
            variant="contained"
            disabled={testLoading}
            startIcon={testLoading ? <CircularProgress size={16} /> : <TestIcon />}
          >
            {testLoading ? '测试中...' : '开始测试'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 消息提示 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default SystemSettings;