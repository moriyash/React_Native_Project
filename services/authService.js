import axios from 'axios';

const API_BASE_URL = 'http://192.168.1.222:3000/api';

// יצירת instance של axios עם הגדרות בסיסיות
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 שניות timeout
});

export const authService = {
  // הרשמה
  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Network error'
      };
    }
  },

  // התחברות
 login: async (credentials) => {
  try {
    const response = await api.post('/auth/login', credentials);
    console.log("📦 Server response:", response.data); // 🟡 חשוב!
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Network error'
    };
  }
}
,

  // שכחת סיסמה
  forgotPassword: async (email) => {
    try {
      const response = await api.post('/auth/forgotpassword', { email });
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Network error'
     };
}
}
};