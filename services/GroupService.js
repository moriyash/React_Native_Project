// services/GroupService.js

import axios from 'axios';

class GroupService {
  constructor() {
    this.baseURL = 'http://192.168.1.222:3000/api'; // עדכן לפי הכתובת שלך
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

      const response = await axios.post(`${this.baseURL}/groups`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('✅ Group created successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Create group error:', error);
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
      const response = await axios.get(`${this.baseURL}/groups`, { params });

      console.log('✅ Groups fetched successfully:', response.data.length);
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Fetch groups error:', error);
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
  async updateGroup(groupId, groupData, imageUri = null) {
    try {
      console.log('🔄 Updating group...');
      
      const formData = new FormData();
      
      // הוספת נתוני הקבוצה המעודכנים
      if (groupData.name) formData.append('name', groupData.name);
      if (groupData.description !== undefined) formData.append('description', groupData.description);
      if (groupData.category) formData.append('category', groupData.category);
      if (groupData.rules !== undefined) formData.append('rules', groupData.rules);
      if (groupData.isPrivate !== undefined) formData.append('isPrivate', groupData.isPrivate.toString());
      if (groupData.allowMemberPosts !== undefined) formData.append('allowMemberPosts', groupData.allowMemberPosts.toString());
      if (groupData.requireApproval !== undefined) formData.append('requireApproval', groupData.requireApproval.toString());
      if (groupData.allowInvites !== undefined) formData.append('allowInvites', groupData.allowInvites.toString());
      
      // הוספת תמונה חדשה אם יש
      if (imageUri) {
        formData.append('image', {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'group-image.jpg',
        });
      }

      const response = await axios.put(`${this.baseURL}/groups/${groupId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('✅ Group updated successfully');
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('❌ Update group error:', error);
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
}

export const groupService = new GroupService();