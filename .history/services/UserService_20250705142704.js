// services/UserService.js
import axios from 'axios';

class UserService {
  constructor() {
    this.baseURL = 'http://192.168.0.101:3000'; // ללא /api כי נוסיף אותו בקריאות
  }

  // פונקציה חדשה לחיפוש משתמשים
  async searchUsers(query, currentUserId = 'temp-user-id') {
    try {
      console.log('🔍 UserService: Searching users for:', query);
      
      const response = await axios.get(`${this.baseURL}/api/users/search`, {
        params: { q: query },
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        timeout: 10000, // 10 שניות timeout
      });

      console.log('✅ UserService: Search successful, found:', response.data.length, 'users');
      return response.data;
      
    } catch (error) {
      console.error('❌ UserService: Search users error:', error);
      
      if (error.response) {
        // השרת החזיר שגיאה
        console.error('Response error:', error.response.status, error.response.data);
      } else if (error.request) {
        // הבקשה נשלחה אבל לא התקבלה תשובה
        console.error('No response received:', error.request);
      } else {
        // משהו אחר השתבש
        console.error('Request setup error:', error.message);
      }
      
      // החזר מערך ריק במקום לזרוק שגיאה כדי שהאפליקציה לא תקרוס
      return [];
    }
  }

  // Delete user account permanently
  async deleteUserAccount(userId, password) {
    try {
      console.log('🗑️ UserService: Deleting user account for ID:', userId);
      
      const deleteData = {
        userId: userId,
        password: password, // אישור סיסמה לבטיחות
        confirmDelete: true
      };

      const endpoints = [
        { url: '/api/auth/delete-account', method: 'delete' },
        { url: '/api/user/delete', method: 'delete' },
        { url: '/api/auth/delete-user', method: 'delete' }
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`🔄 Trying delete endpoint: ${endpoint.url}`);
          
          const response = await axios({
            method: endpoint.method,
            url: `${this.baseURL}${endpoint.url}`,
            data: deleteData,
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': userId,
            },
            timeout: 15000, // 15 שניות למחיקה
          });

          if (response.data.success || response.status === 200) {
            console.log('✅ User account deleted successfully via:', endpoint.url);
            return {
              success: true,
              message: 'Account deleted successfully',
              data: response.data
            };
          }
        } catch (error) {
          // אם זה שגיאת authentication או validation, תזרוק מיד
          if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            throw new Error(error.response.data.message || 'Authentication failed. Please check your password.');
          }
          
          console.log(`❌ Delete endpoint ${endpoint.url} error:`, error.message);
          continue;
        }
      }

      throw new Error('Account deletion endpoint not available. Please contact support.');
      
    } catch (error) {
      console.error('❌ Delete user account error:', error);
      return {
        success: false,
        message: error.message || 'Failed to delete account'
      };
    }
  }

  // Upload avatar image - עדכון לaxios
  async updateAvatar(imageUri) {
    try {
      console.log('🔄 Uploading avatar...');
      const formData = new FormData();
      formData.append('avatar', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      });

      // נסה כמה endpoints שונים
      const endpoints = [
        '/api/upload/avatar',
        '/api/user/upload-avatar', 
        '/api/auth/avatar'
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`🔄 Trying endpoint: ${endpoint}`);
          
          const response = await axios.post(`${this.baseURL}${endpoint}`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            timeout: 30000, // 30 שניות לאפפלוד
          });

          if (response.data.success) {
            console.log('✅ Avatar uploaded successfully via:', endpoint);
            return {
              success: true,
              data: response.data
            };
          }
        } catch (error) {
          console.log(`❌ Endpoint ${endpoint} error:`, error.message);
          continue;
        }
      }

      throw new Error('Avatar upload not supported yet. Profile will be updated without image.');
      
    } catch (error) {
      console.error('❌ Avatar upload error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Update user profile - עדכון לaxios
  async updateProfile(profileData) {
    try {
      console.log('🔄 Updating profile...');
      
      const endpoints = [
        { url: '/api/auth/update-profile', method: 'put' },
        { url: '/api/auth/profile', method: 'patch' },
        { url: '/api/user/profile', method: 'put' }
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`🔄 Trying endpoint: ${endpoint.url}`);
          
          const response = await axios({
            method: endpoint.method,
            url: `${this.baseURL}${endpoint.url}`,
            data: profileData,
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          });

          console.log('✅ Profile updated successfully via:', endpoint.url);
          return {
            success: true,
            data: response.data
          };
        } catch (error) {
          console.log(`❌ Endpoint ${endpoint.url} error:`, error.message);
          continue;
        }
      }

      throw new Error('Profile update endpoint not available. Please contact support.');
      
    } catch (error) {
      console.error('❌ Update profile error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Change password - עדכון לaxios
  async changePassword(passwordData) {
    try {
      console.log('🔄 Changing password...');
      
      const endpoints = [
        { url: '/api/auth/change-password', method: 'put' },
        { url: '/api/auth/change-password', method: 'patch' },
        { url: '/api/user/change-password', method: 'put' }
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`🔄 Trying password endpoint: ${endpoint.url}`);
          
          const response = await axios({
            method: endpoint.method,
            url: `${this.baseURL}${endpoint.url}`,
            data: passwordData,
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          });

          console.log('✅ Password changed successfully via:', endpoint.url);
          return {
            success: true,
            data: response.data
          };
        } catch (error) {
          // אם זה שגיאת validation או סיסמה שגויה, תזרוק מיד
          if (error.response && error.response.status === 400) {
            throw new Error(error.response.data.message || 'Invalid password');
          }
          
          console.log(`❌ Password endpoint ${endpoint.url} error:`, error.message);
          continue;
        }
      }

      throw new Error('Password change endpoint not available. Please contact support.');
      
    } catch (error) {
      console.error('❌ Change password error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get user profile - עדכון לaxios
  async getUserProfile(userId) {
    try {
      const response = await axios.get(`${this.baseURL}/api/user/profile/${userId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      return {
        success: true,
        data: response.data.user
      };
    } catch (error) {
      console.error('❌ Get user profile error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }
}

export const userService = new UserService();