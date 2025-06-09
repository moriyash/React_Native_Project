// components/screens/groups/GroupDetailsScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../services/AuthContext';
import { groupService } from '../../../services/GroupService';
import { recipeService } from '../../../services/recipeService';
import PostComponent from '../../common/PostComponent';
import CreatePostComponent from '../../common/CreatePostComponent';
import UserAvatar from '../../common/UserAvatar';

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
  warning: '#F39C12',
  info: '#3498DB'
};

const { width: screenWidth } = Dimensions.get('window');

const GroupDetailsScreen = ({ route, navigation }) => {
  const { currentUser } = useAuth();
  const { groupId } = route.params;
  
  // State
  const [group, setGroup] = useState(null);
  const [groupPosts, setGroupPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // נתונים נגזרים
  const isMember = group ? groupService.isMember(group, currentUser?.id || currentUser?._id) : false;
  const isAdmin = group ? groupService.isAdmin(group, currentUser?.id || currentUser?._id) : false;
  const isCreator = group ? groupService.isCreator(group, currentUser?.id || currentUser?._id) : false;
  const hasPendingRequest = group ? groupService.hasPendingRequest(group, currentUser?.id || currentUser?._id) : false;
  const pendingRequestsCount = group?.pendingRequests?.length || 0;

  useEffect(() => {
    loadGroupData();
  }, [groupId]);

  // 🆕 פונקציה לדיבוג הפוסטים
  const debugGroupPosts = async () => {
    try {
      console.log('🐛 DEBUG: Starting post debug for group:', groupId);
      
      // בדיקה ישירה של כל הפוסטים
      const debugResponse = await fetch(`http://192.168.1.222:3000/api/debug/groups/${groupId}/all-posts`);
      
      if (debugResponse.ok) {
        const allPosts = await debugResponse.json();
        console.log('🐛 DEBUG: All posts in database:', allPosts);
        console.log('🐛 DEBUG: Posts breakdown:', {
          total: allPosts.length,
          approved: allPosts.filter(p => p.isApproved).length,
          unapproved: allPosts.filter(p => !p.isApproved).length,
          myPosts: allPosts.filter(p => p.userId === (currentUser?.id || currentUser?._id)).length
        });
      } else {
        console.log('🐛 DEBUG: Could not fetch debug info - endpoint might not exist');
      }
      
      // בדיקת הקריאה הרגילה
      const normalResponse = await groupService.getGroupPosts(groupId, currentUser?.id || currentUser?._id);
      console.log('🐛 DEBUG: Normal API response:', {
        success: normalResponse.success,
        postsCount: normalResponse.data?.length || 0,
        message: normalResponse.message
      });
      
    } catch (error) {
      console.log('🐛 DEBUG: Debug failed:', error);
    }
  };

  const loadGroupData = useCallback(async () => {
    try {
      setLoading(true);
      
      // טען פרטי הקבוצה
      const groupResult = await groupService.getGroup(groupId);
      if (groupResult.success) {
        setGroup(groupResult.data);
        console.log('📋 Group loaded:', {
          name: groupResult.data.name,
          isPrivate: groupResult.data.isPrivate,
          allowMemberPosts: groupResult.data.allowMemberPosts,
          settingsAllowMemberPosts: groupResult.data.settings?.allowMemberPosts,
          requireApproval: groupResult.data.requireApproval,
          settingsRequireApproval: groupResult.data.settings?.requireApproval,
          membersCount: groupResult.data.members?.length,
          creatorId: groupResult.data.creatorId,
          currentUserId: currentUser?.id || currentUser?._id
        });
      } else {
        Alert.alert('Error', groupResult.message || 'Failed to load group');
        return;
      }

      // 🆕 הפעל דיבוג
      await debugGroupPosts();
      
      // טען פוסטים של הקבוצה
      await loadGroupPosts();

    } catch (error) {
      console.error('Load group data error:', error);
      Alert.alert('Error', 'Failed to load group data');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const loadGroupPosts = useCallback(async () => {
    try {
      // השתמש ב-API החדש לפוסטים של קבוצה
      const result = await groupService.getGroupPosts(groupId, currentUser?.id || currentUser?._id);
      
      if (result.success) {
        const sortedPosts = (result.data || []).sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        setGroupPosts(sortedPosts);
        
        // ✅ הצג הודעה ידידותית אם זו קבוצה פרטית
        if (result.message && sortedPosts.length === 0) {
          console.log('ℹ️  Group posts info:', result.message);
        }
      } else {
        console.error('Failed to load group posts:', result.message);
        // ✅ אל תציג שגיאה למשתמש אם זה רק בעיית גישה
        setGroupPosts([]);
      }
    } catch (error) {
      console.error('Load group posts error:', error);
      setGroupPosts([]);
    }
  }, [groupId, currentUser]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGroupData().finally(() => setRefreshing(false));
  }, [loadGroupData]);

  // ✅ עדכון handleJoinGroup לתמוך בביטול בקשה
  const handleJoinGroup = async () => {
    if (!group) return;
    
    setIsJoining(true);
    try {
      // ✅ בדוק אם זה ביטול בקשה או בקשה חדשה
      if (hasPendingRequest) {
        // ביטול בקשה קיימת
        const result = await groupService.cancelJoinRequest(groupId, currentUser?.id || currentUser?._id);
        
        if (result.success) {
          Alert.alert('Request Canceled', 'Your join request has been canceled');
          loadGroupData(); // רענן את הנתונים
        } else {
          Alert.alert('Error', result.message || 'Failed to cancel join request');
        }
      } else {
        // שליחת בקשה חדשה
        const result = await groupService.joinGroup(groupId, currentUser?.id || currentUser?._id);
        
        if (result.success) {
          if (result.data.status === 'pending') {
            Alert.alert('Request Sent', 'Your join request has been sent to the group admin');
          } else {
            Alert.alert('Success', 'You have joined the group successfully!');
          }
          loadGroupData(); // רענן את הנתונים
        } else {
          Alert.alert('Error', result.message || 'Failed to join group');
        }
      }
    } catch (error) {
      console.error('Join/Cancel group error:', error);
      Alert.alert('Error', 'Failed to process request');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!group) return;

    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await groupService.leaveGroup(groupId, currentUser?.id || currentUser?._id);
              
              if (result.success) {
                Alert.alert('Success', 'You have left the group');
                navigation.goBack();
              } else {
                Alert.alert('Error', result.message || 'Failed to leave group');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to leave group');
            }
          }
        }
      ]
    );
  };

  const handlePostCreated = useCallback((newPost) => {
    loadGroupPosts();
  }, [loadGroupPosts]);

  const handlePostDelete = useCallback(async (postId) => {
    try {
      const result = await groupService.deleteGroupPost(groupId, postId, currentUser?.id || currentUser?._id);
      
      if (result.success) {
        loadGroupPosts();
        Alert.alert('Success', 'Recipe deleted successfully');
      } else {
        Alert.alert('Error', result.message || 'Failed to delete recipe');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete recipe');
    }
  }, [loadGroupPosts, groupId, currentUser]);

  const renderGroupHeader = () => {
    if (!group) return null;

    return (
      <View style={styles.groupHeader}>
        {/* תמונת כיסוי */}
        <View style={styles.coverImageContainer}>
          {group.image ? (
            <Image source={{ uri: group.image }} style={styles.coverImage} />
          ) : (
            <View style={styles.placeholderCover}>
              <Ionicons name="people" size={60} color={FLAVORWORLD_COLORS.textLight} />
            </View>
          )}
          
          {/* סמל פרטיות */}
          <View style={[styles.privacyBadge, group.isPrivate && styles.privateBadge]}>
            <Ionicons 
              name={group.isPrivate ? "lock-closed" : "globe"} 
              size={16} 
              color={FLAVORWORLD_COLORS.white} 
            />
            <Text style={styles.privacyText}>
              {group.isPrivate ? 'Private' : 'Public'}
            </Text>
          </View>
        </View>

        {/* פרטי הקבוצה */}
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{group.name}</Text>
          
          <View style={styles.categoryContainer}>
            <Text style={styles.categoryTag}>{group.category}</Text>
          </View>

          {group.description && (
            <Text style={styles.groupDescription}>{group.description}</Text>
          )}

          {/* סטטיסטיקות */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="people-outline" size={20} color={FLAVORWORLD_COLORS.primary} />
              <Text style={styles.statText}>{group.membersCount} members</Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="restaurant-outline" size={20} color={FLAVORWORLD_COLORS.secondary} />
              <Text style={styles.statText}>{groupPosts.length} recipes</Text>
            </View>
          </View>

          {/* יוצר הקבוצה */}
          <View style={styles.creatorInfo}>
            <UserAvatar
              uri={group.creatorAvatar}
              name={group.creatorName}
              size={24}
            />
            <Text style={styles.creatorText}>
              Created by {group.creatorName}
            </Text>
          </View>

          {/* ✅ כפתור פעולה מעודכן */}
          <View style={styles.actionButtonContainer}>
            {!isMember ? (
              hasPendingRequest ? (
                <TouchableOpacity 
                  style={[styles.pendingButton, isJoining && styles.pendingButtonDisabled]}
                  onPress={handleJoinGroup}
                  disabled={isJoining}
                >
                  {isJoining ? (
                    <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.primary} />
                  ) : (
                    <>
                      <Ionicons name="close" size={18} color={FLAVORWORLD_COLORS.primary} />
                      <Text style={styles.pendingButtonText}>Cancel Request</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.joinButton, isJoining && styles.joinButtonDisabled]}
                  onPress={handleJoinGroup}
                  disabled={isJoining}
                >
                  {isJoining ? (
                    <ActivityIndicator size="small" color={FLAVORWORLD_COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="add" size={18} color={FLAVORWORLD_COLORS.white} />
                      <Text style={styles.joinButtonText}>Join Group</Text>
                    </>
                  )}
                </TouchableOpacity>
              )
            ) : (
              <View style={styles.memberActions}>
                <TouchableOpacity style={styles.memberButton}>
                  <Ionicons name="checkmark-circle" size={18} color={FLAVORWORLD_COLORS.success} />
                  <Text style={styles.memberButtonText}>
                    {isCreator ? 'Group Owner' : isAdmin ? 'Admin' : 'Member'}
                  </Text>
                </TouchableOpacity>
                
                {!isCreator && (
                  <TouchableOpacity 
                    style={styles.leaveButton}
                    onPress={handleLeaveGroup}
                  >
                    <Ionicons name="exit-outline" size={18} color={FLAVORWORLD_COLORS.danger} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ✅ עדכון renderCreatePost לבדוק שני המבנים
  const renderCreatePost = () => {
    // 🔧 תיקון בדיקת הרשאות - בדוק שני המבנים
    const allowMemberPosts = group?.settings?.allowMemberPosts ?? group?.allowMemberPosts ?? true;
    
    console.log('🔍 renderCreatePost debug:', {
      isMember,
      allowMemberPosts,
      settingsAllowMemberPosts: group?.settings?.allowMemberPosts,
      directAllowMemberPosts: group?.allowMemberPosts,
      hasSettings: !!group?.settings,
      shouldShowCreatePost: isMember && allowMemberPosts
    });

    if (!isMember) {
      console.log('❌ Not showing create post: user is not a member');
      return null;
    }

    if (!allowMemberPosts) {
      console.log('❌ Not showing create post: member posts not allowed');
      return null;
    }

    console.log('✅ Showing create post section');

    return (
      <View style={styles.createPostContainer}>
        <View style={styles.createPostHeader}>
          <UserAvatar
            uri={currentUser?.avatar}
            name={currentUser?.fullName || currentUser?.name}
            size={40}
          />
          <TouchableOpacity 
            style={styles.createPostInput}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.createPostPlaceholder}>
              Share a recipe with {group.name}...
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.createPostActions}>
          <TouchableOpacity 
            style={styles.createPostButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="restaurant-outline" size={20} color={FLAVORWORLD_COLORS.primary} />
            <Text style={styles.createPostButtonText}>Recipe</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.createPostButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="camera-outline" size={20} color={FLAVORWORLD_COLORS.secondary} />
            <Text style={styles.createPostButtonText}>Photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPost = useCallback(({ item, index }) => {
    return (
      <View style={styles.postContainer}>
        <PostComponent
          post={item || {}}
          navigation={navigation}
          onDelete={handlePostDelete}
          onRefreshData={loadGroupPosts}
          isGroupPost={true}
          groupId={groupId}
          groupName={group?.name}
        />
      </View>
    );
  }, [handlePostDelete, loadGroupPosts, navigation, group, groupId]);

  const renderEmptyComponent = useCallback(() => (
    !loading && (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="restaurant-outline" size={80} color={FLAVORWORLD_COLORS.textLight} />
        </View>
        <Text style={styles.emptyTitle}>No Recipes Yet!</Text>
        <Text style={styles.emptySubtitle}>
          {isMember 
            ? 'Be the first to share a delicious recipe with this group'
            : 'Join the group to see and share amazing recipes'
          }
        </Text>
        {isMember && (group?.settings?.allowMemberPosts ?? group?.allowMemberPosts ?? true) && (
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.emptyButtonText}>Share Recipe</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  ), [loading, isMember, group]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.loadingText}>Loading group...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={80} color={FLAVORWORLD_COLORS.danger} />
          <Text style={styles.errorTitle}>Group Not Found</Text>
          <Text style={styles.errorSubtitle}>This group may have been deleted or you don't have access to it.</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={FLAVORWORLD_COLORS.white} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerBackButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle} numberOfLines={1}>
          {group.name}
        </Text>
        
        <TouchableOpacity 
            style={styles.headerMenuButton}
            onPress={() => {
                if (isAdmin || isCreator) {
                // הצג תפריט אדמין
                Alert.alert(
                    'Admin Options',
                    'Choose an option',
                    [
                    {
                        text: `Manage Requests ${pendingRequestsCount > 0 ? `(${pendingRequestsCount})` : ''}`,
                        onPress: () => navigation.navigate('GroupAdminRequests', { 
                        groupId: groupId, 
                        groupName: group?.name 
                        })
                    },
                    {
                        text: 'Group Settings',
                        onPress: () => {
                        // TODO: נווט להגדרות קבוצה
                        Alert.alert('Coming Soon', 'Group settings feature is coming soon!');
                        }
                    },
                    {
                        text: 'Cancel',
                        style: 'cancel'
                    }
                    ]
                );
                } else {
                Alert.alert('Info', 'Group options will be available here');
                }
            }}
            >
            <View style={styles.menuButtonContainer}>
                <Ionicons name="ellipsis-horizontal" size={24} color={FLAVORWORLD_COLORS.accent} />
                {(isAdmin || isCreator) && pendingRequestsCount > 0 && (
                <View style={styles.requestsBadge}>
                    <Text style={styles.requestsBadgeText}>{pendingRequestsCount}</Text>
                </View>
                )}
            </View>
            </TouchableOpacity>
      </View>
      
      <FlatList
        data={groupPosts}
        keyExtractor={(item) => item._id || item.id || Math.random().toString()}
        renderItem={renderPost}
        ListHeaderComponent={() => (
          <View>
            {renderGroupHeader()}
            {renderCreatePost()}
          </View>
        )}
        ListEmptyComponent={renderEmptyComponent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[FLAVORWORLD_COLORS.primary]}
            tintColor={FLAVORWORLD_COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={3}
      />

      {/* מודל יצירת פוסט */}
      {showCreateModal && isMember && (
        <Modal
          visible={showCreateModal}
          animationType="slide"
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                onPress={() => setShowCreateModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={FLAVORWORLD_COLORS.accent} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Share Recipe</Text>
              <View style={styles.modalPlaceholder} />
            </View>
            
            <CreatePostComponent
              currentUser={currentUser}
              groupId={groupId} // ⬅️ חשוב! לציין שזה פוסט של קבוצה
              groupName={group.name}
              onPostCreated={(newPost) => {
                handlePostCreated(newPost);
                setShowCreateModal(false);
              }}
            />
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const additionalStyles = StyleSheet.create({
  menuButtonContainer: {
    position: 'relative',
  },
  requestsBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: FLAVORWORLD_COLORS.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.white,
  },
  requestsBadgeText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 10,
    fontWeight: '600',
  },
});

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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerBackButton: {
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
    marginHorizontal: 16,
  },
  headerMenuButton: {
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  backButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  groupHeader: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    marginBottom: 8,
  },
  coverImageContainer: {
    position: 'relative',
    height: 200,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderCover: {
    width: '100%',
    height: '100%',
    backgroundColor: FLAVORWORLD_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacyBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.secondary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  privateBadge: {
    backgroundColor: FLAVORWORLD_COLORS.accent,
  },
  privacyText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  groupInfo: {
    padding: 20,
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 8,
  },
  categoryContainer: {
    marginBottom: 12,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 14,
    color: FLAVORWORLD_COLORS.secondary,
    fontWeight: '600',
  },
  groupDescription: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.text,
    lineHeight: 22,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  statText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    marginLeft: 6,
    fontWeight: '500',
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  creatorText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    marginLeft: 8,
  },
  actionButtonContainer: {
    alignItems: 'center',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 120,
    justifyContent: 'center',
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  pendingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  pendingButtonText: {
    color: FLAVORWORLD_COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  pendingButtonDisabled: {
    opacity: 0.6,
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.background,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: FLAVORWORLD_COLORS.success,
  },
  memberButtonText: {
    color: FLAVORWORLD_COLORS.success,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  leaveButton: {
    padding: 10,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.danger,
    marginLeft: 12,
  },
  createPostContainer: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    marginBottom: 8,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  createPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  createPostInput: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
    marginLeft: 12,
  },
  createPostPlaceholder: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
  },
  createPostActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: FLAVORWORLD_COLORS.border,
  },
  createPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
  },
  createPostButtonText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.text,
    marginLeft: 6,
    fontWeight: '500',
  },
  postContainer: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    marginHorizontal: 0,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  separator: {
    height: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 20,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.white,
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
    backgroundColor: FLAVORWORLD_COLORS.white,
  },
  modalCloseButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
  },
  modalPlaceholder: {
    width: 32,
  },
  ...additionalStyles,
});

export default GroupDetailsScreen;