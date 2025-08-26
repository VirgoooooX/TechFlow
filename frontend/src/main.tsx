import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { CssBaseline } from '@mui/material'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'react-hot-toast'

import App from './App'
import { store } from './store/index'
import AuthProvider from './components/AuthProvider'
import { FontSizeProvider } from './contexts/FontSizeContext'
import { DynamicThemeProvider } from './contexts/ThemeContext'
import './styles/global.css'

// 创建 React Query 客户端
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true, // 允许窗口获得焦点时重新获取
      refetchOnMount: true, // 组件挂载时重新获取
      staleTime: 2 * 60 * 1000, // 2分钟
      gcTime: 10 * 60 * 1000, // 10分钟 (原 cacheTime)
    },
    mutations: {
      retry: 1,
    },
  },
})

// 错误边界组件
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <h1>出现了一些问题</h1>
          <p>页面遇到了错误，请刷新页面重试。</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <AuthProvider>
                <FontSizeProvider>
                  <DynamicThemeProvider>
                    <CssBaseline />
                    <App />
                    <Toaster
                      position="top-right"
                      toastOptions={{
                        duration: 4000,
                        style: {
                          background: '#363636',
                          color: '#fff',
                        },
                        success: {
                          duration: 3000,
                          iconTheme: {
                            primary: '#4caf50',
                            secondary: '#fff',
                          },
                        },
                        error: {
                          duration: 5000,
                          iconTheme: {
                            primary: '#f44336',
                            secondary: '#fff',
                          },
                        },
                      }}
                    />
                    {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
                  </DynamicThemeProvider>
                </FontSizeProvider>
              </AuthProvider>
            </BrowserRouter>
          </QueryClientProvider>
        </Provider>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)