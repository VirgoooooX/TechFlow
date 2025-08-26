import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Chip,
  Button,
  TextField,
  InputAdornment,
  Skeleton,
  Alert,
  Pagination,
  Stack,
  IconButton,
  Tabs,
  Tab
} from '@mui/material';
import {
  Search as SearchIcon,
  TrendingUp as TrendingIcon,
  Schedule as ScheduleIcon,
  Language as LanguageIcon,
  StarBorder as StarBorderIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useTheme, useMediaQuery } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFontSize } from '../contexts/FontSizeContext';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { articlesApi, userApi } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Article {
  id: number;
  titleEn: string;
  titleCn?: string;
  summary?: string;
  imageUrl?: string;
  publishedAt: string;
  author?: string;
  source: {
    id: number;
    name: string;
    category: string;
    type?: string;
  };
  difficulty?: string;
  wordCount?: number;
}

interface ArticlesResponse {
  articles: Article[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface NewsSource {
  id: string;
  name: string;
  type: string;
  category: string;
  isDefault: boolean;
  subscribed?: boolean;
}

const Home: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useSelector((state: RootState) => state.auth);
  const queryClient = useQueryClient();
  const { fontSize } = useFontSize();
  
  // 从location.state中获取初始状态
  const locationState = location.state as any;
  const isReturningFromArticle = locationState?.fromArticleDetail;
  
  // 使用一个统一的状态对象来管理所有相关状态
  const [appState, setAppState] = useState(() => {
    if (isReturningFromArticle) {
      return {
        page: locationState.page || 1,
        search: locationState.search || '',
        searchInput: locationState.search || '',
        selectedTab: locationState.selectedTab || 0,
        sourceId: locationState.sourceId,
        refreshingSource: null,
        isInitialized: true
      };
    }
    return {
      page: 1,
      search: '',
      searchInput: '',
      selectedTab: 0,
      sourceId: undefined,
      refreshingSource: null,
      isInitialized: false
    };
  });
  
  // 解构状态以保持向后兼容
  const { page, search, searchInput, selectedTab, sourceId, refreshingSource } = appState;
  
  // 状态更新函数
  const updateAppState = (updates: Partial<typeof appState>) => {
    setAppState(prev => ({ ...prev, ...updates }));
  };
  
  const setPage = (page: number) => updateAppState({ page });
  const setSearch = (search: string) => updateAppState({ search });
  const setSearchInput = (searchInput: string) => updateAppState({ searchInput });
  const setSelectedTab = (selectedTab: number) => updateAppState({ selectedTab });
  const setSourceId = (sourceId: string | undefined) => updateAppState({ sourceId });
  const setRefreshingSource = (refreshingSource: string | null | undefined) => updateAppState({ refreshingSource: refreshingSource as null | undefined });

  // 获取文章列表
  const {
    data: articlesData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['articles', page, search, sourceId],
    queryFn: async (): Promise<ArticlesResponse> => {
      const response = await articlesApi.getArticles({
        page,
        limit: 30,
        search: search || undefined,
        sortBy: 'publishedAt',
        sortOrder: 'desc',
        sourceId: sourceId || undefined
      });
       return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2分钟
    refetchOnWindowFocus: true, // 窗口获得焦点时重新获取
    refetchOnMount: true, // 组件挂载时重新获取
  });

  // 获取热门文章
  const { data: trendingArticles } = useQuery<Article[]>({
    queryKey: ['trending-articles'],
    queryFn: async () => {
      const response = await articlesApi.getTrendingArticles({ limit: 5 });
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10分钟
  });

  // 获取新闻源列表
  const { data: newsSourcesData } = useQuery({
    queryKey: ['news-sources'],
    queryFn: async () => {
      const response = await userApi.getNewsSources();
      return response.data;
    },
    enabled: !!user, // 只有用户登录时才获取新闻源
    staleTime: 5 * 60 * 1000, // 5分钟
    refetchOnWindowFocus: false, // 禁用窗口焦点时重新获取
    refetchOnMount: true, // 组件挂载时重新获取
  });

  // 获取用户设置
  const { data: userSettings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const response = await userApi.getSettings();
      return response.data.settings;
    },
    enabled: !!user, // 只有用户登录时才获取设置
    staleTime: 5 * 60 * 1000, // 5分钟
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // 处理新闻源数据
  const newsSources = useMemo(() => {
    if (!newsSourcesData) return [];
    const defaultSources = newsSourcesData.defaultSources || [];
    const userSources = newsSourcesData.userSources || [];
    const allSources = [...defaultSources, ...userSources];
    // 只返回已启用的新闻源
    return allSources.filter(source => source.subscribed !== false);
  }, [newsSourcesData]);
  


  // 刷新单个新闻源
  const refreshSingleSourceMutation = useMutation({
    mutationFn: (sourceId: string) => articlesApi.refreshSingleSource(sourceId),
    onSuccess: () => {
      // 刷新文章列表
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['trending-articles'] });
      setRefreshingSource(null);
    },
    onError: (error) => {
      console.error('刷新新闻源失败:', error);
      setRefreshingSource(null);
    },
  });

  // 立即恢复滚动位置（不等待newsSources加载）
  useEffect(() => {
    if (appState.isInitialized) {
      const state = location.state as any;
      if (state?.scrollPosition) {
        // 立即恢复滚动位置，不等待其他数据加载
        setTimeout(() => {
          window.scrollTo(0, state.scrollPosition);
        }, 0);
      }
    }
  }, [appState.isInitialized, location.state]);

  // 当新闻源加载完成后的初始化逻辑
  useEffect(() => {
    if (newsSources && newsSources.length > 0) {
      if (appState.isInitialized) {
        // 根据sourceId更新selectedTab
        if (sourceId) {
          const tabIndex = newsSources.findIndex(source => source.id === sourceId);
          if (tabIndex !== -1 && tabIndex !== selectedTab) {
            setSelectedTab(tabIndex);
          }
        }
      } else {
        // 首次访问，选择第一个新闻源
        if (!sourceId) {
          setSourceId(newsSources[0].id);
        }
      }
    }
  }, [newsSources, appState.isInitialized, sourceId, selectedTab]);

  // 搜索处理
  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 清除搜索
  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  // 处理标签页切换
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
    setPage(1);
    
    if (newsSources && newsSources[newValue]) {
      // 选择特定新闻源
      setSourceId(newsSources[newValue].id);
    }
  };

  // 处理刷新单个新闻源
  const handleRefreshSource = (sourceId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // 防止触发标签页切换
    setRefreshingSource(sourceId);
    refreshSingleSourceMutation.mutate(sourceId);
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: zhCN
    });
  };

  // 处理文章点击，保存当前状态
  const handleArticleClick = (articleId: number) => {
    const currentState = {
      fromArticleDetail: true,
      selectedTab,
      sourceId,
      page,
      search,
      scrollPosition: window.scrollY
    };
    
    navigate(`/article/${articleId}`, { state: currentState });
  };

  // 文章卡片组件
  const ArticleCard: React.FC<{ article: Article }> = ({ article }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const difficulty = article.difficulty || '中级';
    const wordCount = article.wordCount || 0;
    const published = new Date(article.publishedAt);
    const dateLabel = `${published.getMonth() + 1}-${published.getDate()}`;
    const isTextOnly = article.source?.type === 'rss-text';
    
    // 移动端布局
    if (isMobile) {
      return (
        <Card sx={{ cursor:'pointer', transition:'all 0.2s ease-in-out', '&:hover':{transform:'translateY(-2px)', boxShadow:2}, display:'flex', flexDirection:'column', mb:1.5, borderRadius:1.5, px:0.5 }} onClick={() => handleArticleClick(article.id)}>
          <Box sx={{ display:'flex', alignItems:'center', p:2, pb:1 }}>
            <Box sx={{ flex:'1 1 auto', display:'flex', flexDirection:'column', gap:0.5, pr: isTextOnly ? 0 : 1 }}>
              {/* 英文标题 */}
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  fontWeight: 600, 
                  fontSize: fontSize === 'small' ? '0.85rem' : fontSize === 'large' ? '1.05rem' : '0.95rem', 
                  lineHeight: 1.35,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  color: '#333'
                }}
              >
                {article.titleEn}
              </Typography>
              {/* 中文标题 */}
              {article.titleCn && userSettings?.autoTranslate && (
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ 
                    fontSize: '0.85rem', 
                    lineHeight: 1.4, 
                    display: '-webkit-box', 
                    WebkitLineClamp: 2, 
                    WebkitBoxOrient: 'vertical', 
                    overflow: 'hidden',
                    fontWeight: 500
                  }}
                >
                  {article.titleCn}
                </Typography>
              )}
              {isTextOnly && article.summary && (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize:'0.8rem', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', mt:0.5 }}>
                  {article.summary}
                </Typography>
              )}
            </Box>
            {!isTextOnly && article.imageUrl && (
              <CardMedia
                component="img"
                image={article.imageUrl}
                alt={article.titleEn}
                sx={{ width:80, height:80, borderRadius:1.5, objectFit:'cover', flexShrink:0 }}
              />
            )}
          </Box>
          <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', px:2, pb:2 }}>
            <Box sx={{ display:'flex', gap:1 }}>
              <Chip label={article.source?.name || '未知来源'} size="small" sx={{ color:'text.secondary', height:22, fontSize:'0.75rem', border:'1px solid', borderColor:'divider', bgcolor:'transparent' }} />
              <Chip label={`${wordCount}词`} size="small" sx={{ color:'text.secondary', height:22, fontSize:'0.75rem', border:'1px solid', borderColor:'divider', bgcolor:'transparent' }} />
              {isTextOnly && (
                <Chip label="纯文字" size="small" sx={{ color:'primary.main', height:22, fontSize:'0.75rem', border:'1px solid', borderColor:'primary.main', bgcolor:'transparent' }} />
              )}
            </Box>
            <Box sx={{ display:'flex', alignItems:'center', color:'text.secondary', fontSize:'0.75rem', height:22 }}>
               <Typography variant="caption" sx={{ mr:0.5, fontSize:'0.75rem', lineHeight:'22px', display:'flex', alignItems:'center' }}>{dateLabel}</Typography>
               <IconButton size="small" onClick={(e) => { e.stopPropagation(); }} sx={{ p:0, width:16, height:16, minWidth:'auto' }}>
                 <StarBorderIcon sx={{ fontSize:14 }} />
               </IconButton>
             </Box>
          </Box>
        </Card>
      );
    }
    // 桌面端布局（保持原有样式）
    return (
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          position: 'relative',
          borderRadius: 1.5,
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 2
          }
        }}
        onClick={() => handleArticleClick(article.id)}
      >
        {!isTextOnly && article.imageUrl && (
          <Box sx={{ position: 'relative' }}>
            <CardMedia
              component="img"
              height="160"
              image={article.imageUrl}
              alt={article.titleEn}
              sx={{ objectFit: 'cover' }}
            />

          </Box>
        )}
        <CardContent sx={{ flexGrow: 1, p: 2, pb: 1 }}>
          {/* 分类标签 */}
          <Box sx={{ mb: 1.5, display: 'flex', gap: 1 }}>
            <Chip
              label={article.source.category || article.source.name}
              size="small"
              sx={{
                backgroundColor: '#f5f5f5',
                color: 'text.secondary',
                fontSize: '0.7rem',
                height: 20
              }}
            />
            {isTextOnly && (
              <Chip
                label="纯文字"
                size="small"
                sx={{
                  backgroundColor: 'primary.50',
                  color: 'primary.main',
                  fontSize: '0.7rem',
                  height: 20
                }}
              />
            )}
          </Box>
          
          {/* 英文标题 */}
          <Typography
            variant="h6"
            component="h2"
            sx={{
              mb: 0.5,
              fontSize: fontSize === 'small' ? '0.9rem' : fontSize === 'large' ? '1.1rem' : '1rem',
              fontWeight: 600,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              color: '#333'
            }}
          >
            {article.titleEn}
          </Typography>
          
          {/* 中文标题/摘要 */}
          {((article.titleCn && userSettings?.autoTranslate) || article.summary) && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mb: 1.5,
                fontSize: fontSize === 'small' ? '0.8rem' : fontSize === 'large' ? '0.95rem' : '0.875rem',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {(article.titleCn && userSettings?.autoTranslate) ? article.titleCn : article.summary}
            </Typography>
          )}
          
          {/* 底部信息 */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mt: 'auto',
            pt: 1
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                {article.source.name}
              </Typography>
              <Typography variant="caption" sx={{ mx: 0.5, color: 'text.secondary' }}>•</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                {wordCount}词
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', fontSize: '0.75rem', height: 22 }}>
              <Typography variant="caption" sx={{ mr: 0.5, fontSize: '0.75rem', lineHeight: '22px', display: 'flex', alignItems: 'center' }}>{dateLabel}</Typography>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); }} sx={{ p: 0, width: 16, height: 16, minWidth: 'auto' }}>
                <StarBorderIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  // 加载骨架屏
  const ArticleSkeleton: React.FC = () => (
    <Card sx={{ height: '100%' }}>
      <Skeleton variant="rectangular" height={200} />
      <CardContent>
        <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
        <Skeleton variant="text" height={32} sx={{ mb: 1 }} />
        <Skeleton variant="text" height={20} sx={{ mb: 1 }} />
        <Skeleton variant="text" width="80%" height={60} sx={{ mb: 2 }} />
        <Skeleton variant="text" width="40%" height={16} />
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth={false} sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: { xs: '100%', md: '1200px' }, mx: 'auto' }}>
      {/* 搜索栏 */}
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2} alignItems="center" justifyContent="center">
          <Grid item xs={9} md={8}>
            <TextField
              fullWidth
              placeholder="搜索文章标题、内容..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={handleKeyPress}
              size="small"
              sx={{ height: '40px', '& .MuiOutlinedInput-root': { height: '40px' } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: search && (
                  <InputAdornment position="end">
                    <Button size="small" onClick={clearSearch}>
                      清除
                    </Button>
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={3} md={2}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleSearch}
              disabled={isLoading}
              size="small"
              sx={{ height: '40px' }}
            >
              搜索
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* 新闻源标签页 */}
      {user && (
        <Box sx={{ mb: 1 }}>
          {newsSources && newsSources.length > 0 ? (
            <Tabs
              value={selectedTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTabs-indicator': {
                  backgroundColor: 'primary.main',
                },
                '& .MuiTab-root': {
                  minWidth: 'auto',
                  px: 2,
                  py: 0.5,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  '&.Mui-selected': {
                    color: 'primary.main',
                    fontWeight: 600,
                  },
                },
              }}
            >
              {newsSources.map((source) => (
                <Tab
                  key={source.id}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {source.name}
                      {source.type === 'rss-text' && (
                        <Chip
                          label="文字"
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.6rem',
                            bgcolor: 'primary.50',
                            color: 'primary.main',
                            '& .MuiChip-label': { px: 0.5 }
                          }}
                        />
                      )}
                      <RefreshIcon 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRefreshSource(source.id, e);
                        }}
                        sx={{ 
                          fontSize: '0.875rem',
                          ml: 0.5,
                          cursor: refreshingSource === source.id ? 'default' : 'pointer',
                          opacity: refreshingSource === source.id ? 0.5 : 0.7,
                          animation: refreshingSource === source.id ? 'spin 1s linear infinite' : 'none',
                          '&:hover': {
                            opacity: refreshingSource === source.id ? 0.5 : 1,
                          },
                          '@keyframes spin': {
                            '0%': {
                              transform: 'rotate(0deg)',
                            },
                            '100%': {
                              transform: 'rotate(360deg)',
                            },
                          },
                        }} 
                      />
                    </Box>
                  }
                />
              ))}
            </Tabs>
          ) : (
            // 加载状态占位符，保持布局稳定
            <Box sx={{ height: 48, display: 'flex', alignItems: 'center' }}>
              <Skeleton variant="rectangular" width={200} height={32} sx={{ borderRadius: 1 }} />
              <Skeleton variant="rectangular" width={150} height={32} sx={{ borderRadius: 1, ml: 2 }} />
              <Skeleton variant="rectangular" width={180} height={32} sx={{ borderRadius: 1, ml: 2 }} />
            </Box>
          )}
        </Box>
      )}

      {/* 热门文章 */}
      {trendingArticles && trendingArticles.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <TrendingIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h5" component="h2">
              热门文章
            </Typography>
          </Box>
          <Grid container spacing={2}>
            {trendingArticles?.slice(0, 3).map((article) => (
              <Grid item xs={12} md={4} key={article.id}>
                <ArticleCard article={article} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}



      {/* 文章列表 */}
      <Box sx={{ mb: 4 }}>
        {search && (
          <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
            搜索结果: "{search}"
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            加载文章失败，请稍后重试
            <Button size="small" onClick={() => refetch()} sx={{ ml: 2 }}>
              重试
            </Button>
          </Alert>
        )}

        <Grid container spacing={{ xs: 1, md: 3 }}>
          {isLoading
            ? Array.from({ length: 12 }).map((_, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <ArticleSkeleton />
                </Grid>
              ))
            : articlesData?.articles?.map((article) => (
                <Grid item xs={12} sm={6} md={4} key={article.id}>
                  <ArticleCard article={article} />
                </Grid>
              )) || []
          }
        </Grid>

        {articlesData?.articles?.length === 0 && !isLoading && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {search ? '没有找到相关文章' : '暂无文章'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {search ? '尝试使用其他关键词搜索' : '请稍后再来查看'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* 分页 */}
      {articlesData && articlesData.pagination?.pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={articlesData.pagination?.pages || 1}
            page={page}
            onChange={(_, newPage) => setPage(newPage)}
            color="primary"
            size="large"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* 用户提示 */}
      {!user && (
        <Box sx={{ mt: 6, textAlign: 'center' }}>
          <Alert severity="info" sx={{ maxWidth: 600, mx: 'auto' }}>
            <Typography variant="body1" gutterBottom>
              <LanguageIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              登录后可享受更多功能
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • 个性化文章推荐 • 生词本功能 • 阅读进度跟踪 • 自定义设置
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mt: 2, justifyContent: 'center' }}>
              <Button
                variant="contained"
                onClick={() => navigate('/login')}
              >
                立即登录
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/register')}
              >
                注册账号
              </Button>
            </Stack>
          </Alert>
        </Box>
      )}
    </Container>
  );
};

export default Home;