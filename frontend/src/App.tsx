// import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';

// 页面组件
import Articles from './pages/Home'; // 重命名为Articles，实际使用原Home组件
import ArticleDetail from './pages/ArticleDetail';
import Vocabulary from './pages/Vocabulary';
import Settings from './pages/Settings';

import Login from './pages/Login';
import Register from './pages/Register';
import DebugAuth from './pages/DebugAuth';


// 路由守卫组件
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

function App() {
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route 
            index 
            element={
              <ProtectedRoute>
                <Articles />
              </ProtectedRoute>
            } 
          />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route 
            path="article/:id" 
            element={
              <ProtectedRoute>
                <ArticleDetail />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="vocabulary" 
            element={
              <ProtectedRoute>
                <Vocabulary />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="settings" 
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="debug-auth" 
            element={<DebugAuth />} 
          />

        </Route>
      </Routes>
    </Box>
  )
}

export default App;