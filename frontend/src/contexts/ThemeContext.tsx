import React, { createContext, useContext, useMemo, ReactNode, useState, useEffect } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { useFontSize } from './FontSizeContext';
import { useAuth } from '../hooks/useAuth';
import { userApi } from '../services/api';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: any;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a DynamicThemeProvider');
  }
  return context;
};

export const DynamicThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { fontSize, getFontSizeMultiplier } = useFontSize();
  const { user } = useAuth();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemPrefersDark(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // 从用户设置加载主题
  useEffect(() => {
    const loadTheme = async () => {
      if (user) {
        try {
          const response = await userApi.getSettings();
          const settings = response.data.settings;
          if (settings.theme) {
            setThemeModeState(settings.theme as ThemeMode);
          }
        } catch (error) {
          console.error('Failed to load theme setting:', error);
        }
      } else {
        // 未登录用户从localStorage加载
        const savedTheme = localStorage.getItem('theme') as ThemeMode;
        if (savedTheme && ['light', 'dark', 'auto'].includes(savedTheme)) {
          setThemeModeState(savedTheme);
        }
      }
    };

    loadTheme();
  }, [user]);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    
    if (user) {
      // 登录用户保存到服务器
      try {
        await userApi.updateSettings({ theme: mode });
      } catch (error) {
        console.error('Failed to save theme setting:', error);
      }
    } else {
      // 未登录用户保存到localStorage
      localStorage.setItem('theme', mode);
    }
  };

  // 确定实际使用的主题
  const actualTheme = useMemo(() => {
    if (themeMode === 'auto') {
      return systemPrefersDark ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, systemPrefersDark]);
  
  const theme = useMemo(() => {
    const multiplier = getFontSizeMultiplier();
    const isDark = actualTheme === 'dark';
    
    return createTheme({
      palette: {
        mode: isDark ? 'dark' : 'light',
        primary: {
          main: '#1976d2',
          light: '#42a5f5',
          dark: '#1565c0',
        },
        secondary: {
          main: '#dc004e',
          light: '#ff5983',
          dark: '#9a0036',
        },
        background: {
          default: isDark ? '#121212' : '#ffffff',
          paper: isDark ? '#1e1e1e' : '#f5f5f5',
        },
        text: {
          primary: isDark ? '#ffffff' : '#333333',
          secondary: isDark ? '#b3b3b3' : '#666666',
        },
      },
      typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", "Noto Sans SC", sans-serif',
        fontSize: 14 * multiplier,
        h1: {
          fontSize: `${2.5 * multiplier}rem`,
          fontWeight: 600,
        },
        h2: {
          fontSize: `${2 * multiplier}rem`,
          fontWeight: 600,
        },
        h3: {
          fontSize: `${1.75 * multiplier}rem`,
          fontWeight: 600,
        },
        h4: {
          fontSize: `${1.5 * multiplier}rem`,
          fontWeight: 600,
        },
        h5: {
          fontSize: `${1.25 * multiplier}rem`,
          fontWeight: 600,
        },
        h6: {
          fontSize: `${1 * multiplier}rem`,
          fontWeight: 600,
        },
        body1: {
          fontSize: `${1 * multiplier}rem`,
          lineHeight: 1.6,
        },
        body2: {
          fontSize: `${0.875 * multiplier}rem`,
          lineHeight: 1.6,
        },
        button: {
          fontSize: `${0.875 * multiplier}rem`,
        },
        caption: {
          fontSize: `${0.75 * multiplier}rem`,
        },
        overline: {
          fontSize: `${0.75 * multiplier}rem`,
        },
      },
      shape: {
        borderRadius: 8,
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              borderRadius: 8,
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
              borderRadius: 12,
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              boxShadow: isDark ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
            },
          },
        },
      },
    });
  }, [fontSize, getFontSizeMultiplier, actualTheme]);

  const value = {
    theme,
    themeMode,
    setThemeMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};