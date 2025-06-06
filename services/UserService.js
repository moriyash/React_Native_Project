// services/userService.js

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://192.168.1.222:3000/api';

// יצירת instance של axios עם הגדרות בסיסיות
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// הוספת טוקן לכל בקשה
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log('No token found');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// טיפול בשגיאות תגובה
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('User API Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url
    });
    return Promise.reject(error);
  }
);

export const userService = {
  // עדכון פרטי משתמש - נשתמש ב-auth endpoint
  updateProfile: async (userData) => {
    try {
      console.log('🔄 Updating user profile...');
      
      // נשתמש ב-auth/update-profile או נתיב דומה
      const response = await api.put('/auth/update-profile', userData);
      console.log('✅ Profile updated successfully:', response.data);
      
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Update profile error:', error);
      
      // אם האנדפוינט לא קיים, ננסה להשתמש בשיטה חלופית
      if (error.response?.status === 404) {
        console.log('🔄 Trying alternative endpoint...');
        try {
          // ננסה endpoint חלופי
          const alternativeResponse = await api.patch('/auth/profile', userData);
          return { success: true, data: alternativeResponse.data };
        } catch (altError) {
          return {
            success: false,
            message: 'Profile update endpoint not available. Please contact support.'
          };
        }
      }
      
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to update profile'
      };
    }
  },

  // עדכון תמונת פרופיל - נתמקד על שיטה פשוטה יותר
  updateAvatar: async (imageUri) => {
    try {
      console.log('📷 Updating profile picture...');
      
      // ננסה קודם עם endpoint פשוט
      const formData = new FormData();
      formData.append('avatar', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      });

      // ננסה כמה endpoints אפשריים
      const possibleEndpoints = [
        '/auth/avatar',
        '/auth/upload-avatar', 
        '/user/upload-avatar',
        '/upload/avatar'
      ];

      for (const endpoint of possibleEndpoints) {
        try {
          console.log(`🔄 Trying endpoint: ${endpoint}`);
          const response = await api.post(endpoint, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            timeout: 60000,
          });

          console.log('✅ Avatar updated successfully:', response.data);
          return { success: true, data: response.data };
        } catch (endpointError) {
          if (endpointError.response?.status !== 404) {
            // אם זה לא 404, זה אומר שהאנדפוינט קיים אבל יש בעיה אחרת
            throw endpointError;
          }
          // אחרת ממשיכים לאנדפוינט הבא
          console.log(`❌ Endpoint ${endpoint} not found, trying next...`);
        }
      }

      // אם כל האנדפוינטים נכשלו
      return {
        success: false,
        message: 'Avatar upload not supported yet. Profile will be updated without image.'
      };

    } catch (error) {
      console.error('❌ Update avatar error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to update profile picture'
      };
    }
  },

  // שינוי סיסמה
  changePassword: async (passwordData) => {
    try {
      console.log('🔐 Changing password...');
      
      // ננסה כמה endpoints אפשריים לשינוי סיסמה
      const possibleEndpoints = [
        '/auth/change-password',
        '/auth/update-password',
        '/user/password'
      ];

      for (const endpoint of possibleEndpoints) {
        try {
          console.log(`🔄 Trying password endpoint: ${endpoint}`);
          const response = await api.put(endpoint, {
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword
          });

          console.log('✅ Password changed successfully');
          return { success: true, data: response.data };
        } catch (endpointError) {
          if (endpointError.response?.status !== 404) {
            throw endpointError;
          }
          console.log(`❌ Endpoint ${endpoint} not found, trying next...`);
        }
      }

      return {
        success: false,
        message: 'Password change feature not available yet. Please contact support.'
      };

    } catch (error) {
      console.error('❌ Change password error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to change password'
      };
    }
  },

  // קבלת פרטי משתמש
  getUserProfile: async (userId) => {
    try {
      console.log('👤 Fetching user profile...');
      
      // ננסה כמה endpoints אפשריים
      const possibleEndpoints = [
        `/auth/user/${userId}`,
        `/user/${userId}`,
        `/users/${userId}`,
        '/auth/me' // עבור המשתמש הנוכחי
      ];

      for (const endpoint of possibleEndpoints) {
        try {
          console.log(`🔄 Trying profile endpoint: ${endpoint}`);
          const response = await api.get(endpoint);
          console.log('✅ User profile fetched successfully');
          return { success: true, data: response.data };
        } catch (endpointError) {
          if (endpointError.response?.status !== 404) {
            throw endpointError;
          }
          console.log(`❌ Endpoint ${endpoint} not found, trying next...`);
        }
      }

      return {
        success: false,
        message: 'User profile endpoint not available.'
      };
      
    } catch (error) {
      console.error('❌ Get user profile error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch user profile'
      };
    }
  },

  // מחיקת חשבון
  deleteAccount: async () => {
    try {
      console.log('🗑️ Deleting user account...');
      
      const response = await api.delete('/auth/delete-account');
      console.log('✅ Account deleted successfully');
      
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Delete account error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to delete account'
      };
    }
  }
};