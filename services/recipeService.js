import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://192.168.1.222:3000/api'; // ✅ עדכן לIP הנכון של המחשב שלך

// יצירת instance של axios עם הגדרות בסיסיות
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 שניות
});

// Interceptor להוספת token לכל בקשה
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

// Interceptor לתגובות
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url
    });
    return Promise.reject(error);
  }
);

export const recipeService = {
  // בדיקת חיבור לשרת
  testConnection: async () => {
    try {
      console.log('🔗 Testing server connection...');
      const response = await api.get('/');
      console.log('✅ Server connection successful');
      return { success: true };
    } catch (error) {
      console.error('❌ Server connection failed:', error);
      return { success: false, error: error.message };
    }
  },

  // יצירת מתכון חדש
  createRecipe: async (recipeData) => {
    try {
      console.log('📤 Creating recipe on server...', recipeData.title);
      
      // ✅ בדיקה בסיסית של הנתונים
      if (!recipeData || !recipeData.title) {
        throw new Error('Missing required recipe data');
      }

      // ✅ בדיקה אם יש תמונה
      if (recipeData.image) {
        console.log('📷 Image detected, using FormData...');
        
        const formData = new FormData();
        
        // הוסף את כל השדות
        formData.append('title', recipeData.title || '');
        formData.append('description', recipeData.description || '');
        formData.append('ingredients', recipeData.ingredients || '');
        formData.append('instructions', recipeData.instructions || '');
        formData.append('category', recipeData.category || '');
        formData.append('meatType', recipeData.meatType || '');
        formData.append('prepTime', (recipeData.prepTime || 0).toString());
        formData.append('servings', (recipeData.servings || 1).toString());
        formData.append('userId', recipeData.userId || '');
        formData.append('userName', recipeData.userName || '');
        formData.append('userAvatar', recipeData.userAvatar || '');
        
        // הוסף תמונה
        formData.append('image', {
          uri: recipeData.image,
          type: 'image/jpeg',
          name: 'recipe.jpg',
        });

        const response = await api.post('/recipes', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 120000, // 2 דקות
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`📊 Upload progress: ${progress}%`);
          }
        });

        console.log('✅ Recipe with image uploaded successfully!');
        return { success: true, data: response.data };

      } else {
        console.log('📝 No image, using JSON...');
        
        // ✅ ללא תמונה - שלח JSON רגיל
        const jsonData = {
          title: recipeData.title,
          description: recipeData.description,
          ingredients: recipeData.ingredients,
          instructions: recipeData.instructions,
          category: recipeData.category,
          meatType: recipeData.meatType,
          prepTime: recipeData.prepTime || 0,
          servings: recipeData.servings || 1,
          userId: recipeData.userId || '',
          userName: recipeData.userName || '',
          userAvatar: recipeData.userAvatar || null
        };

        console.log('📤 Sending JSON data:', jsonData);

        const response = await api.post('/recipes', jsonData, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log('✅ Recipe without image uploaded successfully!');
        return { success: true, data: response.data };
      }

    } catch (error) {
      console.error('❌ Upload error:', error);
      
      let errorMessage = 'Failed to create recipe';
      
      if (error.response) {
        // השרת החזיר תגובה עם שגיאה
        console.error('Server error response:', error.response.data);
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
      } else if (error.request) {
        // הבקשה נשלחה אבל לא הייתה תגובה
        console.error('No response from server');
        errorMessage = 'No response from server. Check your connection.';
      } else if (error.code === 'ECONNABORTED') {
        // timeout
        errorMessage = 'Upload took too long. Please try again.';
      } else {
        // שגיאה אחרת
        errorMessage = error.message || 'Unknown error occurred';
      }
      
      return {
        success: false,
        message: errorMessage,
        details: error.response?.data
      };
    }
  },

  getAllRecipes: async () => {
    try {
      console.log('📥 Fetching all recipes from server...');
      const response = await api.get('/recipes');
      console.log('📥 Server response:', response.data?.length || 0, 'recipes');
      
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Get recipes error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch recipes'
      };
    }
  },

  getRecipeById: async (recipeId) => {
    try {
      const response = await api.get(`/recipes/${recipeId}`);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch recipe'
      };
    }
  },

  updateRecipe: async (recipeId, recipeData) => {
    try {
      const response = await api.put(`/recipes/${recipeId}`, recipeData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to update recipe'
      };
    }
  },

  deleteRecipe: async (recipeId) => {
    try {
      console.log('🗑️ Deleting recipe from server:', recipeId);
      await api.delete(`/recipes/${recipeId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Delete recipe error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to delete recipe'
      };
    }
  },

  likeRecipe: async (recipeId) => {
    try {
      console.log('👍 Liking recipe on server:', recipeId);
      const response = await api.post(`/recipes/${recipeId}/like`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Like recipe error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to like recipe'
      };
    }
  },

  unlikeRecipe: async (recipeId) => {
    try {
      console.log('👎 Unliking recipe on server:', recipeId);
      const response = await api.delete(`/recipes/${recipeId}/like`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Unlike recipe error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to unlike recipe'
      };
    }
  },

  addComment: async (recipeId, commentData) => {
    try {
      console.log('💬 Adding comment to server:', recipeId);
      const response = await api.post(`/recipes/${recipeId}/comments`, {
        text: commentData.text,
        userId: commentData.userId,
        userName: commentData.userName
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Add comment error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to add comment'
      };
    }
  },

  deleteComment: async (recipeId, commentId) => {
    try {
      console.log('🗑️ Deleting comment from server:', commentId);
      await api.delete(`/recipes/${recipeId}/comments/${commentId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Delete comment error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to delete comment'
      };
    }
  }
};