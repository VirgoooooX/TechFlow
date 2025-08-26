import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Popover,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Drawer,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Close as CloseIcon,
  VolumeUp as VolumeUpIcon,
  BookmarkAdd as BookmarkAddIcon,
  Translate as TranslateIcon
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { wordsApi, articlesApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';

interface WordDefinition {
  word: string;
  phonetic?: string;
  definitions?: Array<{
    partOfSpeech: string;
    definition: string;
    example?: string;
    exampleTranslation?: string; // LLM格式的例句翻译
  }>;
  meanings?: Array<{
    partOfSpeech: string;
    definition?: string;  // CSV词典格式
    translation?: string; // CSV词典格式
    definitions?: Array<{ // 标准格式
      definition: string;
      example?: string;
      exampleTranslation?: string; // LLM格式的例句翻译
    }>;
  }>;
}

interface TextInteractionProps {
  children: React.ReactNode;
  className?: string;
}

const TextInteraction: React.FC<TextInteractionProps> = ({ children, className }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [popoverType, setPopoverType] = useState<'word' | 'sentence' | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [wordDefinition, setWordDefinition] = useState<WordDefinition | null>(null);
  const [translatedText, setTranslatedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clickCountRef = useRef(0);

  // 查询单词定义
  const { mutate: queryWord } = useMutation({
    mutationFn: (word: string) => wordsApi.queryWord(word),
    onSuccess: (response) => {
      // 后端返回的数据结构是 {success: true, data: {word, definition, phonetic, cached}}
      // 我们需要使用 response.data.definition
      setWordDefinition(response.data.definition);
      setIsLoading(false);
      setError(null);
    },
    onError: (error: Error) => {
      setIsLoading(false);
      setError((error as any).response?.data?.message || '查词失败');
    }
  });

  // 翻译句子
  const { mutate: translateSentence } = useMutation({
    mutationFn: (sentence: string) => articlesApi.translateSentence(sentence),
    onSuccess: (response) => {
      setTranslatedText(response.data.translatedSentence);
      setIsLoading(false);
      setError(null);
    },
    onError: (error: Error) => {
      setIsLoading(false);
      setError((error as any).response?.data?.message || '翻译失败');
    }
  });

  // 添加到生词本
  const { mutate: addToVocabulary } = useMutation({
    mutationFn: (word: string) => wordsApi.addToVocabulary(word),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
    }
  });

  const handleTextSelection = useCallback((_event: MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // 创建一个虚拟元素来定位popover
    const virtualElement = {
      getBoundingClientRect: () => rect,
      nodeType: 1,
      ownerDocument: document
    } as HTMLElement;

    if (isMobile) {
      setDrawerOpen(true);
    } else {
      setAnchorEl(virtualElement);
    }
    setSelectedText(selectedText);
    
    // 判断是单词还是句子
    const wordPattern = /^[a-zA-Z]+$/;
    if (wordPattern.test(selectedText) && selectedText.split(' ').length === 1) {
      setPopoverType('word');
      setIsLoading(true);
      setError(null);
      setWordDefinition(null);
      queryWord(selectedText.toLowerCase());
    } else {
      setPopoverType('sentence');
      setIsLoading(true);
      setError(null);
      setTranslatedText('');
      translateSentence(selectedText);
    }
  }, [queryWord, translateSentence]);

  const handleClick = useCallback((event: MouseEvent) => {
    clickCountRef.current += 1;
    console.log('点击事件触发，当前点击计数:', clickCountRef.current);
    
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    clickTimeoutRef.current = setTimeout(() => {
      console.log('延时处理，最终点击计数:', clickCountRef.current);
      if (clickCountRef.current === 1) {
        // 单击 - 检查是否点击了单词
        // const target = event.target as HTMLElement;
        // const text = target.textContent || '';
        const clickX = event.clientX;
        const clickY = event.clientY;
        
        // 获取点击位置的单词
        const range = document.caretRangeFromPoint(clickX, clickY);
        if (range) {
          const textNode = range.startContainer;
          if (textNode.nodeType === Node.TEXT_NODE) {
            const text = textNode.textContent || '';
            const offset = range.startOffset;
            
            // 找到单词边界
            let start = offset;
            let end = offset;
            
            while (start > 0 && /[a-zA-Z]/.test(text[start - 1])) {
              start--;
            }
            while (end < text.length && /[a-zA-Z]/.test(text[end])) {
              end++;
            }
            
            const word = text.substring(start, end).trim();
            if (word && /^[a-zA-Z]+$/.test(word)) {
              // 创建选择
              const selection = window.getSelection();
              if (selection) {
                selection.removeAllRanges();
                const newRange = document.createRange();
                newRange.setStart(textNode, start);
                newRange.setEnd(textNode, end);
                selection.addRange(newRange);
                
                // 触发文本选择处理
                handleTextSelection(event);
              }
            }
          }
        }
      } else if (clickCountRef.current === 2) {
        console.log('进入双击处理逻辑 - 选择句子');
        // 双击 - 选择句子（覆盖单击的单词选择）
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges(); // 清除之前的选择
          console.log('清除了之前的选择');
        }
        
        // 关闭可能打开的单词弹窗
        setAnchorEl(null);
        setSelectedText('');
        setWordDefinition(null);
        console.log('关闭了单词弹窗');
        
        try {
          console.log('双击检测到，开始处理句子选择');
          // 获取点击位置的range - 兼容性处理
          let range;
          if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(event.clientX, event.clientY);
          } else if ((document as any).caretPositionFromPoint) {
            // Firefox兼容性
            const caretPosition = (document as any).caretPositionFromPoint(event.clientX, event.clientY);
            if (caretPosition) {
              range = document.createRange();
              range.setStart(caretPosition.offsetNode, caretPosition.offset);
            }
          }
          
          console.log('获取range结果:', range);
          if (!range) {
            console.log('无法获取range，浏览器可能不支持');
            return;
          }
          
          console.log('获取到range:', range);
          // 获取点击的文本节点和偏移量
          const textNode = range.startContainer;
          const offset = range.startOffset;
          console.log('文本节点:', textNode, '偏移量:', offset);
          
          // 获取包含文本的父元素
          let container = textNode.nodeType === Node.TEXT_NODE ? textNode.parentElement : textNode as Element;
          while (container && container.textContent && container.textContent.length < 50) {
            container = container.parentElement;
          }
          
          if (!container || !container.textContent) {
            return;
          }
        
          // 获取完整文本内容
          const fullText = container.textContent;
          
          // 计算点击位置在完整文本中的偏移量
          let absoluteOffset = 0;
          const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null
          );
          
          let currentNode;
          while (currentNode = walker.nextNode()) {
            if (currentNode === textNode) {
              absoluteOffset += offset;
              break;
            }
            absoluteOffset += currentNode.textContent?.length || 0;
          }
        
          // 检查是否是真正的句子结束符的辅助函数
          const isRealSentenceEnd = (position: number, text: string): boolean => {
            const char = text[position];
            if (!/[.!?]/.test(char)) return false;
            
            if (char === '.') {
              // 检查小数点
              const prevChar = position > 0 ? text[position - 1] : '';
              const nextChar = position < text.length - 1 ? text[position + 1] : '';
              if (/\d/.test(prevChar) && /\d/.test(nextChar)) {
                return false; // 这是小数点
              }
              
              // 检查常见缩写词
              const beforeDot = text.substring(Math.max(0, position - 10), position).toLowerCase();
              const commonAbbrevs = ['mr', 'mrs', 'ms', 'dr', 'prof', 'inc', 'ltd', 'corp', 'co', 'vs', 'etc', 'i.e', 'e.g'];
              for (const abbrev of commonAbbrevs) {
                if (beforeDot.endsWith(abbrev)) {
                  return false; // 这是缩写词
                }
              }
              
              // 检查单字母缩写 (如 U.S.A.)
              if (/\b[A-Z]$/.test(beforeDot.trim())) {
                return false;
              }
              
              // 检查文件扩展名或网址
              const afterDot = text.substring(position + 1, Math.min(text.length, position + 10)).toLowerCase();
              if (/^[a-z]{2,4}\b/.test(afterDot) && !/^[a-z]{2,4}\s+[A-Z]/.test(afterDot)) {
                return false; // 可能是文件扩展名或域名
              }
            }
            
            return true;
          };
          
          // 向后查找句子开始
          let sentenceStart = absoluteOffset;
          while (sentenceStart > 0) {
            if (isRealSentenceEnd(sentenceStart - 1, fullText)) {
              break;
            }
            sentenceStart--;
          }
          
          // 跳过句子开始的空白字符
          while (sentenceStart < fullText.length && /\s/.test(fullText[sentenceStart])) {
            sentenceStart++;
          }
          
          // 向前查找句子结束
          let sentenceEnd = absoluteOffset;
          while (sentenceEnd < fullText.length) {
            if (isRealSentenceEnd(sentenceEnd, fullText)) {
              sentenceEnd++;
              // 包含句号后的空格
              while (sentenceEnd < fullText.length && /\s/.test(fullText[sentenceEnd])) {
                sentenceEnd++;
              }
              break;
            }
            sentenceEnd++;
          }
          
          // 提取句子文本
          const sentenceText = fullText.substring(sentenceStart, sentenceEnd).trim();
          console.log('提取的句子文本:', sentenceText);
          console.log('句子开始位置:', sentenceStart, '句子结束位置:', sentenceEnd);
        
          // 创建新的选择范围
          const newRange = document.createRange();
          let currentOffset = 0;
          let startNode = null, startOffset = 0;
          let endNode = null, endOffset = 0;
          console.log('开始查找句子的DOM节点位置');
          
          // 重新遍历找到对应的DOM节点和偏移量
          const rangeWalker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null
          );
          
          let node;
          while (node = rangeWalker.nextNode()) {
            const nodeLength = node.textContent?.length || 0;
            
            // 找到开始位置
            if (!startNode && currentOffset + nodeLength > sentenceStart) {
              startNode = node;
              startOffset = sentenceStart - currentOffset;
            }
            
            // 找到结束位置
            if (!endNode && currentOffset + nodeLength >= sentenceEnd) {
              endNode = node;
              endOffset = sentenceEnd - currentOffset;
              break;
            }
            
            currentOffset += nodeLength;
          }
          
          // 设置选择范围
          if (startNode && endNode) {
            console.log('找到开始节点:', startNode, '偏移:', startOffset);
            console.log('找到结束节点:', endNode, '偏移:', endOffset);
            newRange.setStart(startNode, startOffset);
            newRange.setEnd(endNode, endOffset);
            
            selection.removeAllRanges();
            selection.addRange(newRange);
            console.log('句子选择已设置，当前选择文本:', selection.toString());
            
            // 直接处理句子选择逻辑
            if (sentenceText && sentenceText.length > 0) {
              console.log('开始处理句子选择逻辑，句子文本:', sentenceText);
              const rect = newRange.getBoundingClientRect();
              console.log('句子选择区域:', rect);
              
              // 创建一个虚拟元素来定位popover
              const virtualElement = {
                getBoundingClientRect: () => rect,
                nodeType: 1,
                ownerDocument: document
              } as HTMLElement;

              if (isMobile) {
                setDrawerOpen(true);
                console.log('移动端：打开抽屉');
              } else {
                setAnchorEl(virtualElement);
                console.log('桌面端：设置弹窗锚点');
              }
              setSelectedText(sentenceText);
              setPopoverType('sentence');
              setIsLoading(true);
              setError(null);
              setTranslatedText('');
              console.log('开始翻译句子:', sentenceText);
              translateSentence(sentenceText);
            } else {
              console.log('句子文本为空，无法处理');
            }
          }
          
        } catch (error) {
          console.log('句子选择出现错误，降级到单词选择:', error);
          // 降级到单词选择
          const selection = window.getSelection();
          if (selection) {
            selection.modify('extend', 'forward', 'word');
            const selectedText = selection.toString().trim();
            console.log('降级选择的文本:', selectedText);
            if (selectedText) {
              handleTextSelection(event);
            }
          }
        }
      }
      
      clickCountRef.current = 0;
    }, 200);
  }, [queryWord, translateSentence, isMobile]);

  const handleClose = () => {
    setAnchorEl(null);
    setPopoverType(null);
    setSelectedText('');
    setWordDefinition(null);
    setTranslatedText('');
    setError(null);
    setDrawerOpen(false);
    
    // 清除文本选择
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  };

  const handlePlayPronunciation = (word: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      speechSynthesis.speak(utterance);
    }
  };

  const handleAddToVocabulary = () => {
    if (selectedText && user) {
      addToVocabulary(selectedText.toLowerCase());
    }
  };

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('click', handleClick);
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, [handleClick]);

  const renderWordPopover = () => (
    <Paper sx={{ p: 1.5, maxWidth: 350 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography id="popover-title" variant="h6" component="div" sx={{ lineHeight: 1 }}>
          {selectedText}
        </Typography>
        <IconButton size="small" onClick={handleClose} aria-label="关闭">
          <CloseIcon />
        </IconButton>
      </Box>
      
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {wordDefinition && (
        <Box id="popover-content">
          {wordDefinition.phonetic && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.8 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1, lineHeight: 1.2 }}>
                {wordDefinition.phonetic}
              </Typography>
              <IconButton
                size="small"
                onClick={() => handlePlayPronunciation(wordDefinition.word)}
              >
                <VolumeUpIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
          
          <List dense sx={{ '& .MuiListItem-root': { py: 0.3 } }}>
            {/* 优先显示meanings中的中文翻译 */}
            {wordDefinition.meanings?.map((meaning, meaningIndex) => {
              // 处理CSV词典格式：meaning.definition是字符串
              if (typeof meaning.definition === 'string') {
                return (
                  <ListItem key={meaningIndex} sx={{ px: 0 }}>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                          {(meaning.translation || meaning.definition)?.replace(/\\n/g, '\n')}
                        </Typography>
                      }
                    />
                  </ListItem>
                );
              }
              // 处理标准格式：meaning.definitions是数组
              return meaning.definitions?.map((def, defIndex) => (
                <ListItem key={`${meaningIndex}-${defIndex}`} sx={{ px: 0 }}>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500, whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                        {def.definition?.replace(/\\n/g, '\n')}
                      </Typography>
                    }
                    secondary={def.example && (
                      <Box>
                        <Typography variant="caption" sx={{ fontStyle: 'italic', lineHeight: 1.3, mt: 0.2 }}>
                          例句: {def.example}
                        </Typography>
                        {def.exampleTranslation && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.3, mt: 0.1, display: 'block' }}>
                            翻译: {def.exampleTranslation}
                          </Typography>
                        )}
                      </Box>
                    )}
                  />
                </ListItem>
              ));
            }) ||
            /* 如果没有meanings，显示旧格式的definitions */
            wordDefinition.definitions?.map((def, index) => (
              <ListItem key={index} sx={{ px: 0 }}>
                <ListItemText
                  primary={
                    <Typography variant="body1" sx={{ color: '#000', fontWeight: 400, fontSize: '1rem', whiteSpace: 'pre-line', lineHeight: 1.4, textAlign: 'left' }}>
                       {def.definition?.replace(/\\n/g, '\n')}
                     </Typography>
                  }
                  secondary={def.example && (
                    <Box>
                      <Typography variant="caption" sx={{ fontStyle: 'italic', lineHeight: 1.3, mt: 0.2 }}>
                        例句: {def.example}
                      </Typography>
                      {def.exampleTranslation && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.3, mt: 0.1, display: 'block' }}>
                          翻译: {def.exampleTranslation}
                        </Typography>
                      )}
                    </Box>
                  )}
                />
              </ListItem>
            )) || (
              <ListItem sx={{ px: 0 }}>
                <ListItemText primary="暂无定义" />
              </ListItem>
            )}
          </List>
          

          
          {user && (
            <>
              <Divider sx={{ my: 2 }} />
              <Button
                startIcon={<BookmarkAddIcon />}
                onClick={handleAddToVocabulary}
                size="small"
                variant="outlined"
                fullWidth
              >
                添加到生词本
              </Button>
            </>
          )}
        </Box>
      )}
    </Paper>
  );

  const renderSentencePopover = () => (
    <Paper sx={{ p: 2, maxWidth: 500 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TranslateIcon sx={{ mr: 1 }} />
          <Typography id="popover-title" variant="h6" component="div">
            翻译
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} aria-label="关闭">
          <CloseIcon />
        </IconButton>
      </Box>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        原文: {selectedText}
      </Typography>
      
      <Divider sx={{ mb: 2 }} />
      
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      
      {error && (
        <Alert severity="error">
          {error}
        </Alert>
      )}
      
      {translatedText && (
        <Typography id="popover-content" variant="body1">
          {translatedText}
        </Typography>
      )}
    </Paper>
  );

  // 移动端单词内容
  const renderMobileWordContent = () => (
    <>
      {/* 拖拽指示器 */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <Box sx={{ width: 40, height: 4, bgcolor: 'grey.300', borderRadius: 2 }} />
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
         <Typography 
           id="word-definition-title"
           variant="h4" 
           component="div"
           sx={{ lineHeight: 1 }}
         >
           {selectedText}
         </Typography>
         <IconButton onClick={handleClose} aria-label="关闭">
           <CloseIcon />
         </IconButton>
       </Box>
      
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {wordDefinition && (
        <Box id="word-definition-content">
          {wordDefinition.phonetic && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.8 }}>
               <Typography variant="body2" color="text.secondary" sx={{ mr: 2, fontStyle: 'italic', lineHeight: 1 }}>
                 {wordDefinition.phonetic}
               </Typography>
               <IconButton
                 onClick={() => handlePlayPronunciation(wordDefinition.word)}
                 color="primary"
               >
                 <VolumeUpIcon />
               </IconButton>
             </Box>
          )}
          
          <List sx={{ '& .MuiListItem-root': { px: 0, py: 0.2, alignItems: 'flex-start' } }}>
            {/* 优先显示meanings中的中文翻译 */}
            {wordDefinition.meanings?.map((meaning, meaningIndex) => {
              // 处理CSV词典格式：meaning.definition是字符串
              if (typeof meaning.definition === 'string') {
                return (
                  <ListItem key={meaningIndex}>
                    <ListItemText
                      primary={
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-line', lineHeight: 1.2 }}>
                          {(meaning.translation || meaning.definition)?.replace(/\\n/g, '\n')}
                        </Typography>
                      }
                    />
                  </ListItem>
                );
              }
              // 处理标准格式：meaning.definitions是数组
              return meaning.definitions?.map((def, defIndex) => (
                <ListItem key={`${meaningIndex}-${defIndex}`}>
                  <ListItemText
                    primary={
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-line', lineHeight: 1.2 }}>
                        {def.definition?.replace(/\\n/g, '\n')}
                      </Typography>
                    }
                  />
                </ListItem>
              ));
            }) ||
            /* 如果没有meanings，显示旧格式的definitions */
            wordDefinition.definitions?.map((def, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-line', lineHeight: 1.4 }}>
                      {def.definition?.replace(/\\n/g, '\n')}
                    </Typography>
                  }
                />
              </ListItem>
            )) || (
              <ListItem>
                <ListItemText primary="暂无定义" />
              </ListItem>
            )}
          </List>
          
          {user && (
            <>
              <Divider sx={{ my: 2 }} />
              <Button
                startIcon={<BookmarkAddIcon />}
                onClick={handleAddToVocabulary}
                variant="contained"
                fullWidth
                size="large"
                sx={{ py: 1.2, borderRadius: '20px' }}
              >
                添加到生词本
              </Button>
            </>
          )}
        </Box>
      )}
    </>
  );

  // 移动端句子翻译内容
  const renderMobileSentenceContent = () => (
    <>
      {/* 拖拽指示器 */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <Box sx={{ width: 40, height: 4, bgcolor: 'grey.300', borderRadius: 2 }} />
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TranslateIcon sx={{ mr: 1, fontSize: '1.5rem' }} />
          <Typography 
            id="word-definition-title"
            variant="h5" 
            component="div" 
            sx={{ fontWeight: 600 }}
          >
            翻译
          </Typography>
        </Box>
        <IconButton onClick={handleClose} aria-label="关闭">
          <CloseIcon />
        </IconButton>
      </Box>
      
      <Box id="word-definition-content">
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          原文: {selectedText}
        </Typography>
        
        <Divider sx={{ mb: 2 }} />
        
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        )}
        
        {error && (
          <Alert severity="error">
            {error}
          </Alert>
        )}
        
        {translatedText && (
          <Typography variant="body1">
            {translatedText}
          </Typography>
        )}
      </Box>
    </>
  );

  return (
    <Box ref={containerRef} className={className} sx={{ userSelect: 'text' }}>
      {children}
      
      {/* 桌面端弹窗 */}
      {!isMobile && (
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'center',
          }}
          sx={{ mt: 1 }}
          disableAutoFocus={false}
          disableEnforceFocus={false}
          disableRestoreFocus={false}
          PaperProps={{
            elevation: 8,
            role: 'dialog',
            'aria-modal': 'false',
            'aria-labelledby': 'popover-title',
            'aria-describedby': 'popover-content'
          }}
        >
          {popoverType === 'word' ? renderWordPopover() : renderSentencePopover()}
        </Popover>
      )}
      
      {/* 移动端底部弹出 */}
      {isMobile && (
        <Drawer
          anchor="bottom"
          open={drawerOpen}
          onClose={handleClose}
          disableAutoFocus={false}
          disableEnforceFocus={false}
          disableRestoreFocus={false}
          keepMounted={false}
          ModalProps={{
            'aria-labelledby': 'word-definition-title',
            'aria-describedby': 'word-definition-content'
          }}
          PaperProps={{
            sx: {
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '80vh',
              p: 3
            },
            role: 'dialog',
            'aria-modal': 'true'
          }}
        >
          {popoverType === 'word' ? renderMobileWordContent() : renderMobileSentenceContent()}
        </Drawer>
      )}
    </Box>
  );
};

export default TextInteraction;