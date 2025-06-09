// components/screens/profile/ProfileScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../services/AuthContext';
import { recipeService } from '../../../services/recipeService';
import { userService } from '../../../services/UserService';
import { chatService } from '../../../services/chatServices';
import UserAvatar from '../../common/UserAvatar';
import PostComponent from '../../common/PostComponent';

const FLAVORWORLD_COLORS = {
  primary: '#F5A623',
  secondary: '#4ECDC4',
  accent: '#1F3A93',
  background: '#FFF8F0',
  white: '#FFFFFF',
  text: '#2C3E50',
  textLight: '#7F8C8D',
  border: '#E8E8E8',
  success: '#27AE60',
  danger: '#E74C3C',
};

const { width: screenWidth } = Dimensions.get('window');

const ProfileScreen = ({ route, navigation }) => {
  const { currentUser } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('posts');
  const [stats, setStats] = useState({
    postsCount: 0,
    likesCount: 0,
    followersCount: 0
  });

  // Follow system state
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  const userId = route?.params?.userId || currentUser?.id || currentUser?._id;
  const isOwnProfile = userId === (currentUser?.id || currentUser?._id);

  useEffect(() => {
    loadProfileData();
  }, [userId]);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      if (isOwnProfile) {
        setProfileUser(currentUser);
        console.log('📱 Loading own profile:', currentUser?.fullName);
      } else {
        console.log('🔍 Loading profile for user ID:', userId);
        const userResult = await userService.getUserProfile(userId);
        
        if (userResult.success) {
          setProfileUser(userResult.data);
          console.log('✅ Loaded other user profile:', userResult.data?.fullName);
          
          await loadFollowStatus();
        } else {
          console.error('❌ Failed to load user profile:', userResult.message);
          Alert.alert('Error', 'Failed to load user profile');
          navigation.goBack();
          return;
        }
      }

      await loadUserPosts();
      
    } catch (error) {
      console.error('Profile load error:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadFollowStatus = async () => {
    if (isOwnProfile || !currentUser?.id) return;
    
    try {
      console.log('👥 Loading follow status...');
      
      const result = await chatService.getFollowStatus(
        userId, 
        currentUser.id || currentUser._id
      );
      
      if (result.success) {
        setIsFollowing(result.data.isFollowing);
        setStats(prev => ({
          ...prev,
          followersCount: result.data.followersCount
        }));
        
        console.log('✅ Follow status loaded:', result.data.isFollowing);
      } else {
        console.error('❌ Failed to load follow status:', result.message);
      }
    } catch (error) {
      console.error('❌ Load follow status error:', error);
    }
  };

  const loadUserPosts = async () => {
    try {
      console.log('🔍 Loading posts for user ID:', userId);
      const result = await recipeService.getAllRecipes();
      
      if (result.success) {
        const allPosts = Array.isArray(result.data) ? result.data : [];
        const filteredPosts = allPosts.filter(post => 
          post.userId === userId || 
          post.user?.id === userId || 
          post.user?._id === userId
        );

        console.log(`📊 Found ${filteredPosts.length} posts for user ${userId}`);

        const sortedPosts = filteredPosts.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );

        setUserPosts(sortedPosts);

        const totalLikes = sortedPosts.reduce((sum, post) => 
          sum + (post.likes ? post.likes.length : 0), 0
        );

        setStats(prev => ({
          ...prev,
          postsCount: sortedPosts.length,
          likesCount: totalLikes
        }));
      }
    } catch (error) {
      console.error('Posts load error:', error);
    }
  };

  const handleFollowToggle = async () => {
    if (isFollowLoading || !currentUser?.id) return;
    
    setIsFollowLoading(true);
    try {
      console.log('👥 Toggling follow status...');
      
      const result = await chatService.toggleFollow(
        userId,
        currentUser.id || currentUser._id,
        isFollowing
      );
      
      if (result.success) {
        setIsFollowing(!isFollowing);
        setStats(prev => ({
          ...prev,
          followersCount: result.data.followersCount
        }));
        
        Alert.alert(
          'Success', 
          isFollowing ? 'Unfollowed successfully' : 'Following successfully!'
        );
        
        console.log('✅ Follow status updated');
      } else {
        Alert.alert('Error', result.message || 'Failed to update follow status');
      }
    } catch (error) {
      console.error('❌ Follow toggle error:', error);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (isOwnProfile) {
      Alert.alert('Info', 'You cannot chat with yourself!');
      return;
    }

    if (!profileUser) {
      Alert.alert('Error', 'User information not available');
      return;
    }

    setStartingChat(true);

    try {
      console.log('💬 Starting chat with user:', profileUser);
      
      const result = await chatService.getOrCreatePrivateChat(userId);
      
      if (result.success) {
        navigation.navigate('ChatConversation', {
          chatId: result.data._id,
          otherUser: {
            userId: userId,
            userName: profileUser.fullName || profileUser.name || 'Unknown User',
            userAvatar: profileUser.avatar,
            isOnline: false
          }
        });
      } else {
        Alert.alert('Error', result.message || 'Failed to start chat');
      }
    } catch (error) {
      console.error('❌ Start chat error:', error);
      Alert.alert('Error', 'Failed to start chat');
    } finally {
      setStartingChat(false);
    }
  };

  const handleShowFollowers = async () => {
    try {
      navigation.navigate('FollowersList', {
        userId: userId,
        title: `${profileUser?.fullName || 'User'}'s Followers`,
        listType: 'followers'
      });
    } catch (error) {
      console.error('❌ Navigate to followers error:', error);
    }
  };

  // 🆕 פונקציה לפתיחת מסך הסטטיסטיקות
  const handleViewStatistics = () => {
    console.log('📊 Navigating to UserStatistics with data:', {
      currentUser: profileUser,
      userPosts: userPosts.length,
      userId: userId
    });
    
    navigation.navigate('UserStatistics', {
      currentUser: profileUser,
      userPosts: userPosts,
      userId: userId
    });
  };

  const handleRefreshData = useCallback(() => {
    loadUserPosts();
  }, [userId]);

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handleMyGroups = () => {
    navigation.navigate('Groups');
  };

  const handleSettings = () => {
    Alert.alert('Coming Soon', 'Settings feature is coming soon!');
  };

  const renderProfileHeader = () => (
    <View style={styles.profileHeader}>
      <View style={styles.profileImageContainer}>
        <UserAvatar
          uri={profileUser?.avatar || profileUser?.userAvatar}
          name={profileUser?.fullName || profileUser?.name}
          size={120}
        />
      </View>

      <View style={styles.profileInfo}>
        <Text style={styles.profileName}>
          {profileUser?.fullName || profileUser?.name || 'Anonymous Chef'}
        </Text>
        
        <Text style={styles.profileEmail}>
          {profileUser?.email || 'No email'}
        </Text>

        <Text style={styles.profileBio}>
          {profileUser?.bio || '🍳 Passionate about cooking and sharing delicious recipes!'}
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <TouchableOpacity 
          style={styles.statItem} 
          onPress={() => setSelectedTab('posts')}
        >
          <Text style={styles.statNumber}>{stats.postsCount}</Text>
          <Text style={styles.statLabel}>Recipes</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.statItem} 
          onPress={() => Alert.alert('Likes', `Total likes received: ${stats.likesCount}`)}
        >
          <Text style={styles.statNumber}>{stats.likesCount}</Text>
          <Text style={styles.statLabel}>Likes</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.statItem} 
          onPress={handleShowFollowers}
        >
          <Text style={styles.statNumber}>{stats.followersCount}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionButtons}>
        {isOwnProfile ? (
          <>
            <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
              <Ionicons name="create-outline" size={18} color={FLAVORWORLD_COLORS.white} />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingsButton} onPress={handleSettings}>
              <Ionicons name="settings-outline" size={18} color={FLAVORWORLD_COLORS.accent} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity 
              style={[styles.chatButton, startingChat && styles.buttonDisabled]} 
              onPress={handleStartChat}
              disabled={startingChat}
            >
              {startingChat ? (
                <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
              ) : (
                <Ionicons name="chatbubble-outline" size={18} color={FLAVORWORLD_COLORS.white} />
              )}
              <Text style={styles.chatButtonText}>
                {startingChat ? 'Starting...' : 'Chat'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.followButton, 
                isFollowing && styles.followingButton,
                isFollowLoading && styles.followButtonDisabled
              ]}
              onPress={handleFollowToggle}
              disabled={isFollowLoading}
            >
              {isFollowLoading ? (
                <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
              ) : (
                <>
                  <Ionicons 
                    name={isFollowing ? "checkmark" : "add"} 
                    size={16} 
                    color={FLAVORWORLD_COLORS.white} 
                  />
                  <Text style={styles.followButtonText}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Quick Actions - עם כפתור סטטיסטיקות מעודכן */}
      {isOwnProfile && (
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionItem} onPress={handleMyGroups}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="people" size={20} color={FLAVORWORLD_COLORS.secondary} />
            </View>
            <Text style={styles.quickActionText}>My Groups</Text>
            <Ionicons name="chevron-forward" size={16} color={FLAVORWORLD_COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionItem} 
            onPress={() => navigation.navigate('ChatList')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="chatbubbles" size={20} color={FLAVORWORLD_COLORS.primary} />
            </View>
            <Text style={styles.quickActionText}>My Chats</Text>
            <Ionicons name="chevron-forward" size={16} color={FLAVORWORLD_COLORS.textLight} />
          </TouchableOpacity>

          {/* 🆕 כפתור סטטיסטיקות במקום מתכונים שמורים */}
          <TouchableOpacity 
            style={styles.quickActionItem} 
            onPress={handleViewStatistics}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="analytics" size={20} color={FLAVORWORLD_COLORS.accent} />
            </View>
            <Text style={styles.quickActionText}>My Statistics</Text>
            <Ionicons name="chevron-forward" size={16} color={FLAVORWORLD_COLORS.textLight} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, selectedTab === 'posts' && styles.activeTab]}
        onPress={() => setSelectedTab('posts')}
      >
        <Ionicons 
          name="grid-outline" 
          size={20} 
          color={selectedTab === 'posts' ? FLAVORWORLD_COLORS.primary : FLAVORWORLD_COLORS.textLight} 
        />
        <Text style={[
          styles.tabText,
          selectedTab === 'posts' && styles.activeTabText
        ]}>Recipes</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, selectedTab === 'liked' && styles.activeTab]}
        onPress={() => setSelectedTab('liked')}
      >
        <Ionicons 
          name="heart-outline" 
          size={20} 
          color={selectedTab === 'liked' ? FLAVORWORLD_COLORS.primary : FLAVORWORLD_COLORS.textLight} 
        />
        <Text style={[
          styles.tabText,
          selectedTab === 'liked' && styles.activeTabText
        ]}>Liked</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, selectedTab === 'saved' && styles.activeTab]}
        onPress={() => setSelectedTab('saved')}
      >
        <Ionicons 
          name="bookmark-outline" 
          size={20} 
          color={selectedTab === 'saved' ? FLAVORWORLD_COLORS.primary : FLAVORWORLD_COLORS.textLight} 
        />
        <Text style={[
          styles.tabText,
          selectedTab === 'saved' && styles.activeTabText
        ]}>Saved</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPost = ({ item }) => (
    <PostComponent
      post={item}
      navigation={navigation}
      onRefreshData={handleRefreshData}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="restaurant-outline" size={80} color={FLAVORWORLD_COLORS.textLight} />
      <Text style={styles.emptyTitle}>
        {selectedTab === 'posts' ? 'No Recipes Yet' : 
         selectedTab === 'liked' ? 'No Liked Recipes' : 'No Saved Recipes'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {selectedTab === 'posts' && isOwnProfile ? 
         'Share your first delicious recipe!' : 
         'Start exploring and liking recipes!'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {isOwnProfile ? 'My Profile' : profileUser?.fullName || 'Profile'}
        </Text>
        
        <View style={styles.headerRight}>
          {!isOwnProfile && (
            <TouchableOpacity 
              style={styles.headerChatButton}
              onPress={handleStartChat}
              disabled={startingChat}
            >
              {startingChat ? (
                <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.accent} />
              ) : (
                <Ionicons name="chatbubble-outline" size={20} color={FLAVORWORLD_COLORS.accent} />
              )}
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.menuButton}>
            <Ionicons name="ellipsis-horizontal" size={24} color={FLAVORWORLD_COLORS.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={selectedTab === 'posts' ? userPosts : []}
        keyExtractor={(item) => item._id || item.id}
        renderItem={renderPost}
        ListHeaderComponent={() => (
          <View>
            {renderProfileHeader()}
            {renderTabBar()}
          </View>
        )}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  backButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerChatButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    marginRight: 8,
  },
  menuButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
  },
  profileHeader: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    marginBottom: 8,
  },
  profileBio: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.accent,
  },
  statLabel: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  editButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  settingsButton: {
    padding: 10,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.secondary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  chatButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  followingButton: {
    backgroundColor: FLAVORWORLD_COLORS.success,
  },
  followButtonDisabled: {
    opacity: 0.6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  followButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontWeight: '600',
    marginLeft: 6,
  },
  quickActions: {
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
    padding: 4,
  },
  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: FLAVORWORLD_COLORS.white,
    marginVertical: 2,
    borderRadius: 8,
  },
  quickActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: FLAVORWORLD_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickActionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: FLAVORWORLD_COLORS.text,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: FLAVORWORLD_COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    marginLeft: 8,
    fontWeight: '500',
  },
  activeTabText: {
    color: FLAVORWORLD_COLORS.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default ProfileScreen;