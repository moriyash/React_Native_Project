// services/statisticsService.js

import axios from 'axios';

// ודא שיש לך את ה-BASE_URL בקובץ config או הגדר אותו כאן
const API_BASE_URL = 'http://192.168.1.222:3000'; // עדכן לכתובת השרת שלך

class StatisticsService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/api/statistics`;
    
    // הגדרת axios instance עם headers ברירת מחדל
    this.api = axios.create({
      baseURL: API_BASE_URL, // base URL של השרת שלך
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 שניות timeout
    });

    // Interceptor לטיפול בשגיאות
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('📊 Statistics API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // הוספת token אם נדרש (אם יש authentication)
  setAuthToken(token) {
    if (token) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.api.defaults.headers.common['Authorization'];
    }
  }

  // קבלת נתוני סטטיסטיקות מלאים עבור משתמש
  async getUserStatistics(userId) {
    try {
      console.log('📊 Fetching user statistics for:', userId);
      
      const response = await this.api.get(`/user/${userId}`);

      if (response.data && response.data.success) {
        console.log('✅ Statistics received:', response.data.data);
        return {
          success: true,
          data: response.data.data
        };
      } else {
        console.warn('⚠️ Server returned unsuccessful response:', response.data);
        return {
          success: false,
          message: response.data?.message || 'Failed to fetch statistics'
        };
      }
    } catch (error) {
      console.error('❌ Statistics fetch error:', error);
      
      // טיפול בסוגי שגיאות שונות
      if (error.response) {
        // השרת החזיר תגובה עם status code שגוי
        return {
          success: false,
          message: error.response.data?.message || `Server error: ${error.response.status}`,
          status: error.response.status
        };
      } else if (error.request) {
        // הבקשה נשלחה אבל לא התקבלה תגובה
        return {
          success: false,
          message: 'Network error - server not responding'
        };
      } else {
        // שגיאה בהגדרת הבקשה
        return {
          success: false,
          message: error.message || 'Request configuration error'
        };
      }
    }
  }

  // קבלת התפתחות לייקים לפי פוסטים
  async getLikesProgression(userId) {
    try {
      console.log('📈 Fetching likes progression for:', userId);
      
      const response = await this.api.get(`/likes-progression/${userId}`);
      
      if (response.data && response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          message: response.data?.message || 'Failed to fetch likes progression'
        };
      }
    } catch (error) {
      console.error('❌ Likes progression error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Network error occurred'
      };
    }
  }

  // קבלת עליית עוקבים לאורך זמן - משתמש בendpoint הקיים בשרת
  async getFollowersGrowth(userId) {
    try {
      console.log('👥 Fetching followers data for:', userId);
      
      // השתמש בendpoint הקיים בשרת שלך
      const response = await this.api.get(`/users/${userId}/follow-status/${userId}`, {
        baseURL: `${API_BASE_URL}/api` // עדכן ל-API structure שלך
      });
      
      if (response.data && response.data.followersCount !== undefined) {
        // צור נתוני עליית עוקבים פשוטים מהמידע הנוכחי
        const currentFollowers = response.data.followersCount;
        
        // צור נתונים היסטוריים פשוטים (זה יהיה מוגבל עד שתוסיף tracking אמיתי)
        const followersGrowth = [{
          month: new Date().toLocaleString('default', { month: 'short' }),
          monthYear: new Date().toLocaleString('default', { month: 'short', year: 'numeric' }),
          date: new Date(),
          followers: currentFollowers
        }];
        
        return {
          success: true,
          data: followersGrowth,
          currentFollowersCount: currentFollowers
        };
      } else {
        return {
          success: false,
          message: 'No followers data available'
        };
      }
    } catch (error) {
      console.error('❌ Followers data error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Network error occurred'
      };
    }
  }

  // קבלת התפלגות קטגוריות מתכונים
  async getCategoriesDistribution(userId) {
    try {
      console.log('🥘 Fetching categories distribution for:', userId);
      
      const response = await this.api.get(`/categories-distribution/${userId}`);
      
      if (response.data && response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      } else {
        return {
          success: false,
          message: response.data?.message || 'Failed to fetch categories distribution'
        };
      }
    } catch (error) {
      console.error('❌ Categories distribution error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Network error occurred'
      };
    }
  }

  // עיבוד נתונים אמיתיים מהפוסטים שלי במונגו
  processRealUserData(userPosts, userId) {
    console.log('🔄 Processing real MongoDB data for user:', userId, 'Posts count:', userPosts.length);
    
    // אם אין פוסטים - החזר מבנה ריק
    if (!userPosts || userPosts.length === 0) {
      console.log('📭 No posts found for user, returning empty data structure');
      return {
        totalPosts: 0,
        totalLikes: 0,
        totalFollowers: 0,
        averageLikes: 0,
        likesProgression: [],
        categoriesDistribution: [],
        followersGrowth: []
      };
    }

    const totalPosts = userPosts.length;
    const totalLikes = userPosts.reduce((sum, post) => sum + (post.likes?.length || 0), 0);
    
    // התפתחות לייקים לפי פוסט (ממוין לפי תאריך יצירה אמיתי)
    const likesProgression = userPosts
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((post, index) => ({
        postIndex: index + 1,
        likes: post.likes?.length || 0,
        postTitle: post.title || post.recipeName || `Recipe ${index + 1}`,
        date: new Date(post.createdAt),
        postId: post._id || post.id,
        createdAt: post.createdAt
      }));

    // התפלגות קטגוריות אמיתית מהפוסטים
    const categoriesMap = {};
    userPosts.forEach(post => {
      const category = post.category || post.cuisine || 'Other';
      categoriesMap[category] = (categoriesMap[category] || 0) + 1;
    });

    const categoriesDistribution = Object.entries(categoriesMap).map(([category, count]) => ({
      category,
      count,
      percentage: totalPosts > 0 ? Math.round((count / totalPosts) * 100) : 0
    }));

    // עליית עוקבים - זה יחזור ריק כי זה נתון שצריך לבוא מהשרת
    const followersGrowth = [];

    const processedData = {
      totalPosts,
      totalLikes,
      totalFollowers: 0, // יעודכן מהשרת
      averageLikes: totalPosts > 0 ? Math.round(totalLikes / totalPosts) : 0,
      likesProgression,
      categoriesDistribution,
      followersGrowth
    };

    console.log('✅ Real user data processed:', processedData);
    return processedData;
  }

  // פונקציה לבדיקת חיבור לשרת
  async testConnection() {
    try {
      const response = await this.api.get('/health');
      return {
        success: true,
        message: 'Server connection successful',
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: 'Server connection failed',
        error: error.message
      };
    }
  }

  // פונקציה לעדכון סטטיסטיקות (אם נדרש)
  async updateUserStatistics(userId, statsData) {
    try {
      console.log('🔄 Updating statistics for user:', userId);
      
      const response = await this.api.put(`/user/${userId}`, statsData);
      
      if (response.data && response.data.success) {
        return {
          success: true,
          data: response.data.data,
          message: 'Statistics updated successfully'
        };
      } else {
        return {
          success: false,
          message: response.data?.message || 'Failed to update statistics'
        };
      }
    } catch (error) {
      console.error('❌ Statistics update error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Network error occurred'
      };
    }
  }
}

// יצירת instance יחיד של השירות
const statisticsServiceInstance = new StatisticsService();

// ייצוא named export
export const statisticsService = statisticsServiceInstance;

// ייצוא ברירת מחדל גם כן
export default statisticsServiceInstance;