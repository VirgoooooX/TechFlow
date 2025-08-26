import React, { useMemo } from 'react';
import { Box, Tooltip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { wordsApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';

interface WordHighlightProps {
  text: string;
  className?: string;
}

interface VocabularyWord {
  id: number;
  word: string;
  status: 'new' | 'learning' | 'mastered';
  addedAt: string;
}

const WordHighlight: React.FC<WordHighlightProps> = ({ text, className }) => {
  const { user } = useAuth();

  // 获取用户的生词本
  const { data: vocabulary = [] } = useQuery<VocabularyWord[]>({
    queryKey: ['vocabulary', 'highlight'],
    queryFn: async () => {
      const response = await wordsApi.getVocabulary({ page: 1, limit: 50 });
      return response.data.vocabulary;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  // 创建单词到掌握程度的映射
  const vocabularyMap = useMemo(() => {
    const map = new Map<string, VocabularyWord>();
    vocabulary.forEach(word => {
      map.set(word.word.toLowerCase(), word);
    });
    return map;
  }, [vocabulary]);

  // 获取学习状态对应的颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'rgba(255, 193, 193, 0.6)'; // 柔和的粉红色 - 新单词
      case 'learning':
        return 'rgba(255, 248, 181, 0.7)'; // 柔和的淡黄色 - 学习中
      case 'mastered':
        return 'rgba(200, 230, 201, 0.6)'; // 柔和的淡绿色 - 已掌握
      default:
        return 'transparent';
    }
  };

  // 获取学习状态的中文描述
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new':
        return '新单词';
      case 'learning':
        return '学习中';
      case 'mastered':
        return '已掌握';
      default:
        return '';
    }
  };

  // 处理文本高亮
  const highlightText = useMemo(() => {
    if (!user || vocabulary.length === 0) {
      return <span>{text}</span>;
    }

    // 创建正则表达式来匹配生词本中的单词
    const words = Array.from(vocabularyMap.keys());
    if (words.length === 0) {
      return <span>{text}</span>;
    }

    // 按长度排序，优先匹配长单词
    words.sort((a, b) => b.length - a.length);
    
    // 创建正则表达式，使用单词边界确保完整匹配
    const pattern = new RegExp(
      `\\b(${words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
      'gi'
    );

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      // 添加匹配前的文本
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {text.slice(lastIndex, match.index)}
          </span>
        );
      }

      // 获取匹配的单词信息
      const matchedWord = match[1].toLowerCase();
      const wordInfo = vocabularyMap.get(matchedWord);
      
      if (wordInfo) {
        const backgroundColor = getStatusColor(wordInfo.status);
        const statusLabel = getStatusLabel(wordInfo.status);
        
        parts.push(
          <Tooltip
            key={`word-${match.index}`}
            title={`${wordInfo.word} - ${statusLabel}`}
            arrow
            placement="top"
          >
            <Box
              component="span"
              sx={{
                backgroundColor,
                padding: '2px 4px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                '&:hover': {
                  opacity: 0.9,
                  transform: 'scale(1.01)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }
              }}
            >
              {match[1]}
            </Box>
          </Tooltip>
        );
      } else {
        parts.push(
          <span key={`word-${match.index}`}>
            {match[1]}
          </span>
        );
      }

      lastIndex = pattern.lastIndex;
    }

    // 添加剩余的文本
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.slice(lastIndex)}
        </span>
      );
    }

    return <>{parts}</>;
  }, [text, vocabularyMap, user, vocabulary.length]);

  return (
    <Box className={className} sx={{ lineHeight: 1.6 }}>
      {highlightText}
    </Box>
  );
};

export default WordHighlight;