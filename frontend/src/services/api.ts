import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 文章相关API
export const articlesApi = {
  getArticles: (params?: any) => api.get('/articles', { params }),
  getArticle: (id: string) => api.get(`/articles/${id}`),
  getArticleById: (id: string) => api.get(`/articles/${id}`),
  getTrendingArticles: (params?: any) => api.get('/articles/trending', { params }),
  translateSentence: (sentence: string) => api.post('/articles/translate', { sentence }),
  refreshNews: () => api.post('/articles/refresh'),
  refreshSingleSource: (sourceId: string) => api.post(`/articles/refresh/${sourceId}`),
};

// 单词相关API
export const wordsApi = {
  queryWord: (word: string, context?: string) => api.post('/words/query', { word, context }),
  addToVocabulary: (word: string) => api.post('/words/vocabulary', { word }),
  getVocabulary: (params?: any) => api.get('/words/vocabulary', { params }),
  updateStatus: (wordId: string, status: string) => api.put(`/words/vocabulary/${wordId}/status`, { status }),
  removeFromVocabulary: (wordId: string) => api.delete(`/words/vocabulary/${wordId}`),
  getWordStats: () => api.get('/words/stats'),
};

// 用户相关API
export const userApi = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data: any) => api.put('/users/profile', data),
  getSettings: () => api.get('/users/settings'),
  updateSettings: (data: any) => api.put('/users/settings', data),
  getNewsSources: () => api.get('/users/news-sources'),
  addNewsSource: (data: any) => api.post('/users/news-sources', data),
  deleteNewsSource: (id: string) => api.delete(`/users/news-sources/${id}`),
  toggleSubscription: (sourceId: string, isEnabled: boolean) => api.put(`/users/news-sources/${sourceId}/subscription`, { isEnabled }),
  testLLM: (data: any) => api.post('/users/test-llm', data),
};

// 系统设置相关API
export const systemApi = {
  getSettings: () => api.get('/system/settings'),
  updateSettings: (data: any) => api.put('/system/settings', data),
  testLLMConfig: () => api.post('/system/test-llm'),
};

// 认证相关API
export const authApi = {
  login: (credentials: { email: string; password: string }) => api.post('/auth/login', credentials),
  register: (userData: { username: string; email: string; password: string }) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  refreshToken: () => api.post('/auth/refresh'),
  verifyToken: () => api.get('/auth/verify'),
};

export default api;