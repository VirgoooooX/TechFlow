import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Skeleton,
  Alert,
  Pagination,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Popover,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  VolumeUp as VolumeIcon,
  Article as ArticleIcon,
  MoreVert as MoreIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useFontSize } from '../contexts/FontSizeContext';
import { wordsApi } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface VocabularyItem {
  id: string;
  word: string;
  definition: {
    meanings: Array<{
      partOfSpeech: string;
      definitions: Array<{
        definition: string;
        example?: string;
      }>;
    }>;
    pronunciation?: string;
  };
  phonetic?: string;
  context?: string;
  article?: {
    id: number;
    titleEn: string;
    titleCn?: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface VocabularyResponse {
  vocabulary: VocabularyItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}



const Vocabulary: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { fontSize } = useFontSize();
  const queryClient = useQueryClient();
  
  console.log('📚 Vocabulary: 组件渲染，认证状态:', { user: user?.username, isAuthenticated, isLoading });
  
  const [page, setPage] = useState(1);
  const [selectedWord, setSelectedWord] = useState<VocabularyItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [expandedWords, setExpandedWords] = useState<Set<string>>(new Set());

  // 获取生词本
  const {
    data: vocabularyData,
    isLoading: vocabularyLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['vocabulary', page],
    queryFn: async (): Promise<VocabularyResponse> => {
      console.log('📚 Vocabulary: 开始获取生词本数据，page:', page);
      const response = await wordsApi.getVocabulary({
        page,
        limit: 20
      });
      console.log('📚 Vocabulary: 生词本API响应:', response);
      
      // 适配后端返回的数据结构
      const result = {
        vocabulary: Array.isArray(response.data?.vocabulary) ? response.data.vocabulary : [],
        pagination: response.data?.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          pages: 1
        }
      };
      console.log('📚 Vocabulary: 处理后的数据:', result);
      return result;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2分钟
  });



  // 更新学习状态
  const { mutate: updateStatus, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      wordsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
      queryClient.invalidateQueries({ queryKey: ['word-stats'] });
      setEditDialogOpen(false);
    }
  });

  // 删除生词
  const { mutate: removeWord, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => wordsApi.removeFromVocabulary(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
      queryClient.invalidateQueries({ queryKey: ['word-stats'] });
      setDeleteDialogOpen(false);
      setSelectedWord(null);
    }
  });



  // 朗读单词
  const handleSpeak = (word: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: zhCN
    });
  };

  // 获取学习状态标签
  const getStatusLabel = (status: string) => {
    const labels = {
      'new': '新单词',
      'learning': '学习中',
      'mastered': '已掌握'
    };
    return labels[status as keyof typeof labels] || '未知';
  };

  // 获取学习状态颜色
  const getStatusColor = (status: string) => {
    const colors = {
      'new': 'error',
      'learning': 'warning',
      'mastered': 'success'
    } as const;
    return (status in colors ? colors[status as keyof typeof colors] : 'default');
  };

  // 生词列表项组件 - 简洁卡片样式
  const VocabularyListItem: React.FC<{ item: VocabularyItem }> = ({ item }) => {
    const isExpanded = expandedWords.has(item.id);
    
    const toggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      const newExpandedWords = new Set(expandedWords);
      if (isExpanded) {
        newExpandedWords.delete(item.id);
      } else {
        newExpandedWords.add(item.id);
      }
      setExpandedWords(newExpandedWords);
    };

    return (
      <Box
        sx={{
          p: { xs: 2, md: 2 },
          mb: { xs: 2, md: 1.5 },
          backgroundColor: '#ffffff',
          borderRadius: 3,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          border: '1px solid #f0f0f0',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
            transform: 'translateY(-2px)',
            borderColor: '#e0e0e0'
          }
        }}
      >
        {/* 主要内容区域 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
          onClick={(e) => {
            setSelectedWord(item);
            const rect = e.currentTarget.getBoundingClientRect();
            setMenuPosition({
              top: rect.bottom + window.scrollY,
              left: rect.left + window.scrollX
            });
            setMenuAnchor(e.currentTarget);
          }}
        >
          {/* 左侧内容 */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* 单词 */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 1.5, md: 1 } }}>
              <Typography 
                variant="h5" 
                component="h3" 
                sx={{ 
                  fontWeight: 700,
                  fontSize: fontSize === 'small' ? { xs: '1rem', md: '0.9rem' } : fontSize === 'large' ? { xs: '1.2rem', md: '1.1rem' } : { xs: '1.1rem', md: '1rem' },
                  color: '#1a1a1a',
                  letterSpacing: '-0.02em',
                  mr: 2
                }}
              >
                {item.word}
              </Typography>
              <IconButton 
                size="small" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleSpeak(item.word);
                }}
                sx={{ 
                  p: 0.5,
                  color: '#666',
                  '&:hover': {
                    color: '#1976d2',
                    backgroundColor: 'rgba(25, 118, 210, 0.04)'
                  }
                }}
              >
                <VolumeIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* 简洁释义 - 复习模式下可能被遮挡 */}
            <Box sx={{ position: 'relative' }}>
              {/* 释义内容 */}
              <Box>
                {item.definition?.meanings?.slice(0, 1).map((meaning, index) => (
                  <Box key={index}>
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        color: '#666666',
                        fontSize: fontSize === 'small' ? { xs: '0.8rem', md: '0.75rem' } : fontSize === 'large' ? { xs: '1rem', md: '0.95rem' } : { xs: '0.9rem', md: '0.85rem' },
                        lineHeight: 1.4,
                        fontWeight: 400,
                        whiteSpace: 'pre-line'
                      }}
                    >
                      {meaning.definitions?.[0]?.definition?.replace(/\\n/g, '\n')}
                    </Typography>
                  </Box>
                )) || (
                  <Typography variant="body1" sx={{ color: '#999', fontStyle: 'italic' }}>
                    暂无释义信息
                  </Typography>
                )}
              </Box>
              
              {/* 复习模式遮挡层 */}
              {reviewMode && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    border: '2px dashed #ddd'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // 点击遮挡层时显示释义
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    setTimeout(() => {
                      target.style.display = 'flex';
                    }, 3000); // 3秒后重新遮挡
                  }}
                >
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#888',
                      fontWeight: 500,
                      fontSize: '0.875rem'
                    }}
                  >
                    点击查看释义
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* 右侧展开箭头 */}
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
            <IconButton 
              size="medium"
              onClick={toggleExpand}
              sx={{ 
                p: 1,
                color: '#999',
                '&:hover': {
                  color: '#1976d2',
                  backgroundColor: 'rgba(25, 118, 210, 0.04)'
                }
              }}
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        {/* 展开的详细内容 */}
        {isExpanded && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" gutterBottom>
              详细释义
            </Typography>
            
            {/* 显示所有释义 */}
            {item.definition?.meanings?.map((meaning, meaningIndex) => (
              <Box key={meaningIndex} sx={{ mb: 2 }}>
                {meaning.definitions?.map((def, defIndex) => (
                  <Box key={defIndex} sx={{ mb: 1 }}>
                    <Typography variant="body2" sx={{ mb: 0.5, whiteSpace: 'pre-line' }}>
                      {defIndex + 1}. {def.definition?.replace(/\\n/g, '\n')}
                    </Typography>
                    {def.example && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: 'text.secondary',
                          fontStyle: 'italic',
                          display: 'block',
                          ml: 1
                        }}
                      >
                        例句: {def.example}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )) || (
              <Typography variant="body2" color="text.secondary">
                暂无详细释义信息
              </Typography>
            )}
            
            {/* 来源文章信息 */}
            {item.article && (
              <Box sx={{ mt: 2, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  来源文章:
                </Typography>
                <Typography variant="body2">
                  {item.article.titleCn || item.article.titleEn}
                </Typography>
                {item.context && (
                  <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                    上下文: {item.context}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        )}
      </Box>
    );
  };

  // 加载骨架屏 - 列表样式
  const VocabularySkeleton: React.FC = () => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        p: 3,
        mb: 1,
        backgroundColor: 'background.paper',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Skeleton variant="text" width="30%" height={32} sx={{ mb: 1 }} />
        <Skeleton variant="text" width="80%" height={20} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" width="25%" height={16} />
      </Box>
      <Box sx={{ ml: 2 }}>
        <Skeleton variant="text" width={20} height={32} />
      </Box>
    </Box>
  );

  console.log('📚 Vocabulary: 当前数据状态:', { 
    vocabularyData, 
    vocabularyLoading, 
    error, 
    userExists: !!user,
    queryEnabled: !!user 
  });

  if (isLoading) {
    console.log('📚 Vocabulary: 认证状态加载中...');
    return (
      <Container maxWidth={false} sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: { xs: '100%', md: '1200px' }, mx: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <Typography>加载中...</Typography>
        </Box>
      </Container>
    );
  }
  
  if (!user) {
    console.log('📚 Vocabulary: 用户未登录');
    return (
      <Container maxWidth={false} sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: { xs: '100%', md: '1200px' }, mx: 'auto' }}>
        <Alert severity="warning">
          请先登录以查看您的生词本
          <Button onClick={() => navigate('/login')} sx={{ ml: 2 }}>
            立即登录
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: { xs: '100%', md: '1200px' }, mx: 'auto' }}>
      {/* 复习模式切换 */}
      <Box sx={{ mb: { xs: 3, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 2 }}>
          {/* 复习模式切换按钮 */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant={reviewMode ? "contained" : "outlined"}
              size="small"
              onClick={() => setReviewMode(!reviewMode)}
              sx={{
                borderRadius: 20,
                px: 2,
                fontSize: '0.875rem',
                textTransform: 'none'
              }}
            >
              {reviewMode ? '退出复习模式' : '复习模式'}
            </Button>
          </Box>
        </Box>
      </Box>





      {/* 生词列表 */}
      <Box sx={{ mb: 4 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            加载生词本失败，请稍后重试
            <Button size="small" onClick={() => refetch()} sx={{ ml: 2 }}>
              重试
            </Button>
          </Alert>
        )}

        <Box>
          {vocabularyLoading
            ? Array.from({ length: 8 }).map((_, index) => (
                <VocabularySkeleton key={index} />
              ))
            : vocabularyData?.vocabulary?.map((item: VocabularyItem) => (
                <VocabularyListItem key={item.id} item={item} />
              )) || []
          }
        </Box>

        {vocabularyData?.vocabulary?.length === 0 && !vocabularyLoading && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              生词本为空
            </Typography>
            <Typography variant="body2" color="text.secondary">
              开始阅读文章，点击单词添加到生词本吧！
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/')}
              sx={{ mt: 2 }}
            >
              去阅读文章
            </Button>
          </Box>
        )}
      </Box>

      {/* 分页 */}
      {vocabularyData && vocabularyData.pagination?.pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={vocabularyData.pagination?.pages || 1}
            page={page}
            onChange={(_, newPage) => setPage(newPage)}
            color="primary"
            size="large"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* 操作菜单 */}
      <Popover
        open={Boolean(menuAnchor) && Boolean(menuPosition)}
        onClose={() => {
          setMenuAnchor(null);
          setMenuPosition(null);
        }}
        anchorReference="anchorPosition"
        anchorPosition={menuPosition ? {
          top: menuPosition.top,
          left: menuPosition.left
        } : undefined}
      >
        <Box sx={{ minWidth: 150 }}>
          <MenuItem
            onClick={() => {
              setEditDialogOpen(true);
              setMenuAnchor(null);
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>编辑掌握程度</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setDeleteDialogOpen(true);
              setMenuAnchor(null);
            }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>删除</ListItemText>
          </MenuItem>
        </Box>
      </Popover>

      {/* 编辑学习状态对话框 */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
      >
        <DialogTitle>编辑学习状态</DialogTitle>
        <DialogContent>
          {selectedWord && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="h6" gutterBottom>
                {selectedWord.word}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                当前学习状态: {getStatusLabel(selectedWord.status)}
              </Typography>
              <Box sx={{ mt: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>选择新的学习状态</InputLabel>
                  <Select
                    value={selectedWord.status}
                    label="选择新的学习状态"
                    onChange={(e) => {
                      if (selectedWord) {
                        setSelectedWord({ ...selectedWord, status: e.target.value as string });
                      }
                    }}
                  >
                    <MenuItem value="new">新单词</MenuItem>
                    <MenuItem value="learning">学习中</MenuItem>
                    <MenuItem value="mastered">已掌握</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>
            取消
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedWord) {
                updateStatus({
                  id: selectedWord.id,
                  status: selectedWord.status
                });
              }
            }}
            disabled={isUpdating}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要从生词本中删除 "{selectedWord?.word}" 吗？此操作无法撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            取消
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (selectedWord) {
                removeWord(selectedWord.id);
              }
            }}
            disabled={isDeleting}
          >
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Vocabulary;