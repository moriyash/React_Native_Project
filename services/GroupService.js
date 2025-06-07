// services/GroupService.js

import axios from 'axios';

class GroupService {
  constructor() {
    this.baseURL = 'http://192.168.1.222:3000/api'; // עדכן לפי הכתובת שלך
    
    // הגדרת axios עם timeout ארוך יותר
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 שניות
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Create new group
  async createGroup(groupData, imageUri = null) {
    try {
      console.log('🔄 Creating group...');
      
      const formData = new FormData();
      
      // הוספת נתוני הקבוצה
      formData.append('name', groupData.name);
      formData.append('description', groupData.description || '');
      formData.append('category', groupData.category || 'General');
      formData.append('rules', groupData.rules || '');
      formData.append('creatorId', groupData.creatorId);
      formData.append('isPrivate', groupData.isPrivate.toString());
      formData.append('allowMemberPosts', groupData.allowMemberPosts.toString());
      formData.append('requireApproval', groupData.requireApproval.toString());
      formData.append('allowInvites', groupData.allowInvites.toString());

      // הוספת תמונה אם יש
      if (imageUri) {
        formData.append('image', {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'group-image.jpg',
        });
      }

      const response = await this.axiosInstance.post('/groups', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 שניות למעלה תמונות
      });

      console.log('✅ Group created successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Create group error:', error);
      
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          message: 'Request timeout - please check your connection and try again'
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Get all groups
  async getAllGroups(userId = null) {
    try {
      console.log('🔄 Fetching groups...');
      
      const params = userId ? { userId } : {};
      
      const response = await this.axiosInstance.get('/groups', { 
        params,
        timeout: 15000 // 15 שניות
      });

      console.log('✅ Groups fetched successfully:', response.data.length);
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Fetch groups error:', error);
      
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          message: 'Connection timeout - please check your network and try again'
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Get single group with details
  async getGroup(groupId) {
    try {
      console.log('🔄 Fetching group details...');
      
      const response = await axios.get(`${this.baseURL}/groups/${groupId}`);

      console.log('✅ Group details fetched successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Fetch group details error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Join group (request to join)
  async joinGroup(groupId, userId) {
    try {
      console.log('🔄 Joining group...');
      
      const response = await axios.post(`${this.baseURL}/groups/${groupId}/join`, {
        userId
      });

      console.log('✅ Join request sent successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Join group error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Approve/Reject join request (admin only)
  async handleJoinRequest(groupId, userId, action, adminId) {
    try {
      console.log(`🔄 ${action}ing join request...`);
      
      const response = await axios.put(`${this.baseURL}/groups/${groupId}/requests/${userId}`, {
        action,
        adminId
      });

      console.log(`✅ Join request ${action}ed successfully`);
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error(`❌ ${action} join request error:`, error);
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Leave group
  async leaveGroup(groupId, userId) {
    try {
      console.log('🔄 Leaving group...');
      
      const response = await axios.delete(`${this.baseURL}/groups/${groupId}/members/${userId}`);

      console.log('✅ Left group successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Leave group error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Delete group (creator only)
  async deleteGroup(groupId, userId) {
    try {
      console.log('🔄 Deleting group...');
      
      const response = await axios.delete(`${this.baseURL}/groups/${groupId}`, {
        data: { userId }
      });

      console.log('✅ Group deleted successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Delete group error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Update group (admin only)
  async updateGroupPost(groupId, postId, updateData, imageUri = null) {
    try {
        console.log('🔄 Updating group post...');
        
        const formData = new FormData();
        
        // הוספת נתוני הפוסט המעודכנים
        formData.append('title', updateData.title);
        formData.append('description', updateData.description || '');
        formData.append('ingredients', updateData.ingredients || '');
        formData.append('instructions', updateData.instructions || '');
        formData.append('category', updateData.category || 'General');
        formData.append('meatType', updateData.meatType || 'Mixed');
        formData.append('prepTime', updateData.prepTime?.toString() || '0');
        formData.append('servings', updateData.servings?.toString() || '1');
        formData.append('userId', updateData.userId);

        // אם יש תמונה חדשה
        if (imageUri) {
        formData.append('image', {
            uri: imageUri,
            type: 'image/jpeg',
            name: 'recipe-image.jpg',
        });
        } else if (updateData.image) {
        // שמירת התמונה הקיימת
        formData.append('image', updateData.image);
        }

        const response = await this.axiosInstance.put(`/groups/${groupId}/posts/${postId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
        });

        console.log('✅ Group post updated successfully');
        return {
        success: true,
        data: response.data
        };
        
    } catch (error) {
        console.error('❌ Update group post error:', error);
        
        if (error.code === 'ECONNABORTED') {
        return {
            success: false,
            message: 'Request timeout - please check your connection and try again'
        };
        }
        
        return {
        success: false,
        message: error.response?.data?.message || error.message
        };
    }
    }

  // Check if user is member of group
  isMember(group, userId) {
    if (!group || !group.members || !userId) return false;
    return group.members.some(member => member.userId === userId);
  }

  // Check if user is admin of group
  isAdmin(group, userId) {
    if (!group || !group.members || !userId) return false;
    return group.members.some(member => 
      member.userId === userId && member.role === 'admin'
    );
  }

  // Check if user is creator of group
  isCreator(group, userId) {
    if (!group || !userId) return false;
    return group.creatorId === userId;
  }

  // Check if user has pending join request
  hasPendingRequest(group, userId) {
    if (!group || !group.pendingRequests || !userId) return false;
    return group.pendingRequests.some(request => request.userId === userId);
  }

  // ============ GROUP POSTS ============

  // Get posts for a specific group
  async getGroupPosts(groupId, userId = null) {
    try {
      console.log('🔄 Fetching group posts...');
      
      const params = userId ? { userId } : {};
      const response = await this.axiosInstance.get(`/groups/${groupId}/posts`, { 
        params,
        timeout: 15000
      });

      console.log('✅ Group posts fetched successfully:', response.data.length);
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Fetch group posts error:', error);
      
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          message: 'Connection timeout - please check your network and try again'
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Create post in group
  async createGroupPost(groupId, postData, imageUri = null) {
    try {
      console.log('🔄 Creating group post...');
      
      const formData = new FormData();
      
      // הוספת נתוני הפוסט
      formData.append('title', postData.title);
      formData.append('description', postData.description || '');
      formData.append('ingredients', postData.ingredients || '');
      formData.append('instructions', postData.instructions || '');
      formData.append('category', postData.category || 'General');
      formData.append('meatType', postData.meatType || 'Mixed');
      formData.append('prepTime', postData.prepTime?.toString() || '0');
      formData.append('servings', postData.servings?.toString() || '1');
      formData.append('userId', postData.userId);

      // הוספת תמונה אם יש
      if (imageUri) {
        formData.append('image', {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'recipe-image.jpg',
        });
      }

      const response = await this.axiosInstance.post(`/groups/${groupId}/posts`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      console.log('✅ Group post created successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Create group post error:', error);
      
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          message: 'Request timeout - please check your connection and try again'
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Delete group post
  async deleteGroupPost(groupId, postId, userId) {
    try {
      console.log('🔄 Deleting group post...');
      
      const response = await this.axiosInstance.delete(`/groups/${groupId}/posts/${postId}`, {
        data: { userId }
      });

      console.log('✅ Group post deleted successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Delete group post error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // ============ GROUP POSTS INTERACTIONS ============

  // Like group post
  async likeGroupPost(groupId, postId, userId) {
    try {
      console.log('👍 Liking group post...');
      
      const response = await this.axiosInstance.post(`/groups/${groupId}/posts/${postId}/like`, {
        userId
      });

      console.log('✅ Group post liked successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Like group post error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Unlike group post
  async unlikeGroupPost(groupId, postId, userId) {
    try {
      console.log('👎 Unliking group post...');
      
      const response = await this.axiosInstance.delete(`/groups/${groupId}/posts/${postId}/like`, {
        data: { userId }
      });

      console.log('✅ Group post unliked successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Unlike group post error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Add comment to group post
  async addCommentToGroupPost(groupId, postId, commentData) {
    try {
      console.log('💬 Adding comment to group post...');
      
      const response = await this.axiosInstance.post(`/groups/${groupId}/posts/${postId}/comments`, commentData);

      console.log('✅ Comment added to group post successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Add comment to group post error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }

  // Delete comment from group post
  async deleteCommentFromGroupPost(groupId, postId, commentId, userId) {
    try {
      console.log('🗑️ Deleting comment from group post...');
      
      const response = await this.axiosInstance.delete(`/groups/${groupId}/posts/${postId}/comments/${commentId}`, {
        data: { userId }
      });

      console.log('✅ Comment deleted from group post successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Delete comment from group post error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
  }
}

export const groupService = new GroupService();