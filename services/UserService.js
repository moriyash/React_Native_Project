// services/UserService.js
class UserService {
  constructor() {
    this.baseURL = 'http://192.168.1.222:3000/api'; // עדכן לפי הכתובת שלך
  }

  // Upload avatar image
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
        '/upload/avatar',
        '/user/upload-avatar', 
        '/auth/avatar'
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`🔄 Trying endpoint: ${endpoint}`);
          
          const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'POST',
            body: formData,
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          const result = await response.json();
          
          if (response.ok && result.success) {
            console.log('✅ Avatar uploaded successfully via:', endpoint);
            return {
              success: true,
              data: result
            };
          } else {
            console.log(`❌ Endpoint ${endpoint} failed:`, result);
            continue;
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

  // Update user profile
  async updateProfile(profileData) {
    try {
      console.log('🔄 Updating profile...');
      
      const endpoints = [
        { url: '/auth/update-profile', method: 'PUT' },
        { url: '/auth/profile', method: 'PATCH' },
        { url: '/user/profile', method: 'PUT' }
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`🔄 Trying endpoint: ${endpoint.url}`);
          
          const response = await fetch(`${this.baseURL}${endpoint.url}`, {
            method: endpoint.method,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(profileData),
          });

          const result = await response.json();
          
          if (response.ok) {
            console.log('✅ Profile updated successfully via:', endpoint.url);
            return {
              success: true,
              data: result
            };
          } else {
            console.log(`❌ Endpoint ${endpoint.url} failed:`, result);
            continue;
          }
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

  // Change password
  async changePassword(passwordData) {
    try {
      console.log('🔄 Changing password...');
      
      const endpoints = [
        { url: '/auth/change-password', method: 'PUT' },
        { url: '/auth/change-password', method: 'PATCH' },
        { url: '/user/change-password', method: 'PUT' }
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`🔄 Trying password endpoint: ${endpoint.url}`);
          
          const response = await fetch(`${this.baseURL}${endpoint.url}`, {
            method: endpoint.method,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(passwordData),
          });

          const result = await response.json();
          
          if (response.ok) {
            console.log('✅ Password changed successfully via:', endpoint.url);
            return {
              success: true,
              data: result
            };
          } else {
            console.log(`❌ Password endpoint ${endpoint.url} failed:`, result);
            
            // אם זה שגיאת סיסמה שגויה, תזרוק אותה מיד
            if (response.status === 400 && result.message) {
              throw new Error(result.message);
            }
            continue;
          }
        } catch (error) {
          // אם זה שגיאת validation או סיסמה שגויה, תזרוק מיד
          if (error.message.includes('password') || error.message.includes('Password')) {
            throw error;
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

  // Get user profile
  async getUserProfile(userId) {
    try {
      const response = await fetch(`${this.baseURL}/user/profile/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (response.ok) {
        return {
          success: true,
          data: result.user
        };
      } else {
        throw new Error(result.message || 'Failed to get user profile');
      }
    } catch (error) {
      console.error('❌ Get user profile error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

export const userService = new UserService();