import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { userApi } from '../services/api';

export type FontSize = 'small' | 'medium' | 'large';

interface FontSizeContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  getFontSizeMultiplier: () => number;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

export const useFontSize = () => {
  const context = useContext(FontSizeContext);
  if (context === undefined) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
};

interface FontSizeProviderProps {
  children: ReactNode;
}

export const FontSizeProvider: React.FC<FontSizeProviderProps> = ({ children }) => {
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');
  const { user } = useAuth();

  // 从用户设置加载字号
  useEffect(() => {
    const loadFontSize = async () => {
      if (user) {
        try {
          const response = await userApi.getSettings();
          const settings = response.data.settings;
          if (settings.fontSize) {
            setFontSizeState(settings.fontSize as FontSize);
          }
        } catch (error) {
          console.error('Failed to load font size setting:', error);
        }
      } else {
        // 未登录用户从localStorage加载
        const savedFontSize = localStorage.getItem('fontSize') as FontSize;
        if (savedFontSize && ['small', 'medium', 'large'].includes(savedFontSize)) {
          setFontSizeState(savedFontSize);
        }
      }
    };

    loadFontSize();
  }, [user]);

  const setFontSize = async (size: FontSize) => {
    setFontSizeState(size);
    
    if (user) {
      // 登录用户保存到服务器
      try {
        await userApi.updateSettings({ fontSize: size });
      } catch (error) {
        console.error('Failed to save font size setting:', error);
      }
    } else {
      // 未登录用户保存到localStorage
      localStorage.setItem('fontSize', size);
    }
  };

  const getFontSizeMultiplier = () => {
    switch (fontSize) {
      case 'small':
        return 0.875; // 87.5%
      case 'large':
        return 1.125; // 112.5%
      case 'medium':
      default:
        return 1; // 100%
    }
  };

  const value = {
    fontSize,
    setFontSize,
    getFontSizeMultiplier,
  };

  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  );
};