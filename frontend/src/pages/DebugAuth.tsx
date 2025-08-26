import React from 'react';
import { useSelector } from 'react-redux';
import { useAuth } from '../hooks/useAuth';
import { RootState } from '../store/index';
import { Container, Typography, Box, Paper, Button } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { wordsApi } from '../services/api';

const DebugAuth: React.FC = () => {
  const authState = useSelector((state: RootState) => state.auth);
  const { user, token, isAuthenticated, isLoading } = useAuth();
  
  // 测试生词本API
  const { data: vocabularyData, isLoading: vocabLoading, error: vocabError } = useQuery({
    queryKey: ['debug-vocabulary'],
    queryFn: async () => {
      console.log('🔍 DebugAuth: 调用生词本API');
      const response = await wordsApi.getVocabulary({ page: 1, limit: 5 });
      console.log('🔍 DebugAuth: 生词本API响应:', response);
      return response;
    },
    enabled: !!user,
    retry: false
  });
  
  const handleRefresh = () => {
    window.location.reload();
  };
  
  const handleClearStorage = () => {
    localStorage.clear();
    window.location.reload();
  };
  
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        认证状态调试页面
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button variant="contained" onClick={handleRefresh}>
          刷新页面
        </Button>
        <Button variant="outlined" color="error" onClick={handleClearStorage}>
          清除存储并刷新
        </Button>
      </Box>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Redux Store 状态
        </Typography>
        <Box component="pre" sx={{ fontSize: '12px', overflow: 'auto', backgroundColor: '#f5f5f5', p: 2, borderRadius: 1 }}>
          {JSON.stringify(authState, null, 2)}
        </Box>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          useAuth Hook 返回值
        </Typography>
        <Box component="pre" sx={{ fontSize: '12px', overflow: 'auto', backgroundColor: '#f5f5f5', p: 2, borderRadius: 1 }}>
          {JSON.stringify({ 
            user: user ? { id: user.id, username: user.username, email: user.email } : null, 
            token: token ? token.substring(0, 20) + '...' : null, 
            isAuthenticated, 
            isLoading 
          }, null, 2)}
        </Box>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          localStorage 内容
        </Typography>
        <Box component="pre" sx={{ fontSize: '12px', overflow: 'auto', backgroundColor: '#f5f5f5', p: 2, borderRadius: 1 }}>
          {JSON.stringify({
            token: localStorage.getItem('token') ? localStorage.getItem('token')?.substring(0, 20) + '...' : null,
            user: localStorage.getItem('user')
          }, null, 2)}
        </Box>
      </Paper>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          生词本 API 测试
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Query Enabled: {!!user ? '是' : '否'}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Loading: {vocabLoading ? '是' : '否'}
        </Typography>
        {vocabError && (
          <Typography variant="body2" color="error" gutterBottom>
            错误: {vocabError.message}
          </Typography>
        )}
        <Box component="pre" sx={{ fontSize: '12px', overflow: 'auto', backgroundColor: '#f5f5f5', p: 2, borderRadius: 1 }}>
          {JSON.stringify(vocabularyData, null, 2)}
        </Box>
      </Paper>
    </Container>
  );
};

export default DebugAuth;