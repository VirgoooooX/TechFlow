import React, { useState, useRef } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Button,
  IconButton,
  Skeleton,
  Alert,
  Snackbar,
  Divider,
  Stack
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Share as ShareIcon,
  VolumeUp as VolumeIcon,
  Language as LanguageIcon
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
// import { useAuth } from '../hooks/useAuth';
import { useFontSize } from '../contexts/FontSizeContext';
import { articlesApi } from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import TextInteraction from '../components/TextInteraction';
import WordHighlight from '../components/WordHighlight';

interface Article {
  id: number;
  titleEn: string;
  titleCn?: string;
  content: string;
  summary?: string;
  imageUrl?: string;
  publishedAt: string;
  author?: string;
  url: string;
  source: {
    id: number;
    name: string;
    category: string;
    url: string;
  };
}



const ArticleDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // const { user } = useAuth();
  const { fontSize } = useFontSize();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // 获取文章详情
  const {
    data: article,
    isLoading,
    error
  } = useQuery<Article>({
    queryKey: ['article', id],
    queryFn: async () => {
      const response = await articlesApi.getArticleById(id!);
      // 后端返回的数据结构是 { success: true, data: { article } }
      // 响应拦截器返回了 response.data，所以这里是 { success: true, data: { article } }
      return response.data.article;
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10分钟
  });









  // 分享文章
  const handleShare = async () => {
    if (navigator.share && article) {
      try {
        await navigator.share({
          title: article.titleEn,
          text: article.summary || article.titleCn,
          url: window.location.href
        });
      } catch (error) {
        // 用户取消分享或不支持
      }
    } else {
      // 复制链接到剪贴板
      navigator.clipboard.writeText(window.location.href);
      setSnackbarMessage('链接已复制到剪贴板');
      setSnackbarOpen(true);
    }
  };

  // 朗读文本
  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    } else {
      setSnackbarMessage('您的浏览器不支持语音朗读');
      setSnackbarOpen(true);
    }
  };

  // 处理返回
  const handleGoBack = () => {
    const state = location.state as any;
    if (state?.fromArticleDetail) {
      // 如果有保存的状态，导航回Home页面并传递状态
      navigate('/', { state: state });
    } else {
      // 否则使用浏览器历史记录返回
      navigate(-1);
    }
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '时间未知';
      }
      return formatDistanceToNow(date, {
        addSuffix: true,
        locale: zhCN
      });
    } catch (error) {
      return '时间未知';
    }
  };



  if (isLoading) {
    return (
      <Container maxWidth={false} sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: { xs: '100%', md: '900px' }, mx: 'auto' }}>
        <Skeleton variant="rectangular" height={300} sx={{ mb: 3 }} />
        <Skeleton variant="text" height={60} sx={{ mb: 2 }} />
        <Skeleton variant="text" height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={400} />
      </Container>
    );
  }

  if (error || !article) {
    return (
      <Container maxWidth={false} sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: { xs: '100%', md: '900px' }, mx: 'auto' }}>
        <Alert severity="error">
          文章加载失败，请稍后重试
          <Button onClick={handleGoBack} sx={{ ml: 2 }}>
            返回
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: { xs: 2, md: 4 }, px: { xs: 1, md: 3 }, maxWidth: { xs: '100%', md: '900px' }, mx: 'auto' }}>
      {/* 返回按钮 */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={handleGoBack}
        sx={{ mb: 3 }}
      >
        返回
      </Button>

      {/* 文章头部 */}
      <Card sx={{ mb: 4 }}>
        {article.imageUrl && (
          <CardMedia
            component="img"
            height="300"
            image={article.imageUrl}
            alt={article.titleEn}
            sx={{ objectFit: 'cover' }}
          />
        )}
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          {/* 文章元信息 - 标签和时间合并到一行 */}
          <Box sx={{ mb: 2 }}>
            <Stack 
              direction="row" 
              spacing={2} 
              sx={{ 
                mb: 1.5,
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              {/* 标签组 */}
              <Stack direction="row" spacing={1}>
                {article.source && (
                  <>
                    <Chip
                      label={article.source.name}
                      color="primary"
                      variant="outlined"
                      size="small"
                      sx={{ fontSize: '0.75rem', height: 24 }}
                    />
                    {article.source.category && (
                      <Chip 
                        label={article.source.category} 
                        size="small"
                        sx={{ fontSize: '0.75rem', height: 24 }}
                      />
                    )}
                  </>
                )}
              </Stack>
              
              {/* 时间信息 */}
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ 
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap'
                }}
              >
                {formatTime(article.publishedAt)}
                {article.author && ` • ${article.author}`}
              </Typography>
            </Stack>
          </Box>

          {/* 文章标题 - 统一使用紧凑字体 */}
          <Typography 
            variant="h4" 
            component="h1" 
            gutterBottom
            sx={{
              fontSize: fontSize === 'small' ? '1.4rem' : fontSize === 'large' ? '1.8rem' : '1.6rem',
              lineHeight: 1.3,
              mb: 1
            }}
          >
            {article.titleEn}
            <IconButton
              size="small"
              onClick={() => handleSpeak(article.titleEn)}
              sx={{ ml: 1, p: 0.5 }}
            >
              <VolumeIcon fontSize="small" />
            </IconButton>
          </Typography>
          
          {article.titleCn && (
            <Typography
              variant="h6"
              color="text.secondary"
              gutterBottom
              sx={{ 
                fontWeight: 400,
                fontSize: fontSize === 'small' ? '0.9rem' : fontSize === 'large' ? '1.1rem' : '1rem',
                mb: 1.5
              }}
            >
              {article.titleCn}
            </Typography>
          )}

          {/* 操作按钮 - 统一使用紧凑的图标按钮 */}
          <Stack 
            direction="row" 
            spacing={0.5} 
            sx={{ 
              mt: 1.5,
              justifyContent: 'flex-end'
            }}
          >
            <IconButton
              size="small"
              onClick={handleShare}
              sx={{ 
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1
              }}
            >
              <ShareIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              component="a"
              sx={{ 
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1
              }}
            >
              <LanguageIcon fontSize="small" />
            </IconButton>
          </Stack>
        </CardContent>
      </Card>

      {/* 文章内容 */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          {article.summary && (
            <>
              <Typography variant="h6" gutterBottom>
                摘要
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                paragraph
                sx={{ 
                  fontStyle: 'italic', 
                  pl: 2, 
                  borderLeft: 3, 
                  borderColor: 'primary.main',
                  fontSize: fontSize === 'small' ? '0.875rem' : fontSize === 'large' ? '1.125rem' : '1rem'
                }}
              >
                {article.summary}
              </Typography>
              <Divider sx={{ my: 3 }} />
            </>
          )}
          
          <Typography variant="h6" gutterBottom>
            正文
            <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 2 }}>
              （点击单词查词，选择句子翻译）
            </Typography>
          </Typography>
          
          <Box
            ref={contentRef}
            sx={{
              '& p': { 
                mb: 2, 
                lineHeight: 1.8,
                fontSize: fontSize === 'small' ? '0.875rem' : fontSize === 'large' ? '1.125rem' : '1rem'
              },
              '& h1, & h2, & h3, & h4, & h5, & h6': { mt: 3, mb: 2 },
              '& ul, & ol': { pl: 3, mb: 2 },
              '& li': { 
                mb: 1,
                fontSize: fontSize === 'small' ? '0.875rem' : fontSize === 'large' ? '1.125rem' : '1rem'
              },
              '& blockquote': {
                pl: 2,
                borderLeft: 3,
                borderColor: 'primary.main',
                fontStyle: 'italic',
                color: 'text.secondary'
              },
              '& code': {
                backgroundColor: 'grey.100',
                padding: '2px 4px',
                borderRadius: 1,
                fontFamily: 'monospace'
              },
              '& pre': {
                backgroundColor: 'grey.100',
                p: 2,
                borderRadius: 1,
                overflow: 'auto'
              },
              userSelect: 'text',
              cursor: 'text'
            }}
          >
            <TextInteraction>
              <WordHighlight
                text={article.content}
              />
            </TextInteraction>
          </Box>
        </CardContent>
      </Card>



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

export default ArticleDetail;