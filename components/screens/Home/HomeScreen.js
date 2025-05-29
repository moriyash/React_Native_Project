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
  Share,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../services/AuthContext';
import { recipeService } from '../../../services/recipeService';
import PostComponent from '../../common/PostComponent';
import CreatePostComponent from '../../common/CreatePostComponent';
import SharePostComponent from '../../common/SharePostComponent';

// צבעי Cooksy
const COOKSY_COLORS = {
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

const HomeScreen = ({ currentUser }) => {
  const { logout } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePost, setSharePost] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false); 

  // טעינת פוסטים
  const loadPosts = useCallback(async () => {
    try {
      console.log('📥 Loading posts...');
      const result = await recipeService.getAllRecipes();
      
      console.log('📥 Load result:', result);
      
      if (result.success) {
        console.log('✅ Posts loaded successfully:', result.data?.length || 0);
        
        const postsArray = Array.isArray(result.data) ? result.data : [];
        
        const formattedPosts = postsArray.map(post => ({
          ...post,
          _id: post._id || post.id,
          userName: post.userName || post.user?.name || post.author?.name || 'Anonymous',
          userAvatar: post.userAvatar || post.user?.avatar || post.author?.avatar || null,
          likes: Array.isArray(post.likes) ? post.likes : [],
          comments: Array.isArray(post.comments) ? post.comments : [],
          createdAt: post.createdAt || post.created_at || new Date().toISOString(),
        }));
        
        const sortedPosts = formattedPosts.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        console.log('✅ Formatted posts:', sortedPosts.length);
        setPosts(sortedPosts);
      } else {
        console.error('❌ Failed to load posts:', result.message);
        Alert.alert('Error', `Failed to load recipes: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ Load posts error:', error);
      Alert.alert('Error', `Failed to load recipes: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPosts();
  }, [loadPosts]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          }
        }
      ]
    );
  }, [logout]);

  const handlePostCreated = useCallback((newPost) => {
    console.log('✅ New post created:', newPost);
    setPosts(prevPosts => [newPost, ...prevPosts]);
  }, []);

  const handlePostUpdate = useCallback((updatedPost) => {
    console.log('📝 Post updated:', updatedPost);
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post._id === updatedPost._id ? updatedPost : post
      )
    );
  }, []);

  const handlePostDelete = useCallback(async (postId) => {
    try {
      console.log('🗑️ Deleting post:', postId);
      const result = await recipeService.deleteRecipe(postId);
      
      if (result.success) {
        setPosts(prevPosts => prevPosts.filter(post => post._id !== postId));
        Alert.alert('Success', 'Recipe deleted successfully');
      } else {
        Alert.alert('Error', result.message || 'Failed to delete recipe');
      }
    } catch (error) {
      console.error('❌ Delete error:', error);
      Alert.alert('Error', 'Failed to delete recipe');
    }
  }, []);

  const handleShare = useCallback((post) => {
    console.log('📤 Sharing post:', post.title);
    setSharePost(post);
    setShowShareModal(true);
  }, []);

  const handleSystemShare = useCallback(async (post) => {
    try {
      const shareContent = {
        message: `Check out this amazing recipe: ${post.title}\n\n${post.description}`,
        title: post.title,
      };
      
      await Share.share(shareContent);
    } catch (error) {
      console.error('Share error:', error);
    }
  }, []);

  const handleShareModalClose = useCallback(() => {
    setShowShareModal(false);
    setSharePost(null);
  }, []);

  const handleShareSubmit = useCallback((shareData) => {
    console.log('📤 Share submitted:', shareData);
    Alert.alert('Success', 'Recipe shared successfully!');
    handleShareModalClose();
  }, [handleShareModalClose]);

  const renderCreatePost = useCallback(() => (
    <View style={styles.createPostContainer}>
      <View style={styles.createPostHeader}>
        <Image 
          source={{ uri: currentUser?.avatar || 'https://randomuser.me/api/portraits/men/32.jpg' }}
          style={styles.createPostAvatar}
        />
        <TouchableOpacity 
          style={styles.createPostInput}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createPostPlaceholder}>
            What delicious recipe will you share today?
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.createPostActions}>
        <TouchableOpacity 
          style={styles.createPostButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="restaurant-outline" size={20} color={COOKSY_COLORS.primary} />
          <Text style={styles.createPostButtonText}>Recipe</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.createPostButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="camera-outline" size={20} color={COOKSY_COLORS.secondary} />
          <Text style={styles.createPostButtonText}>Photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [currentUser]);

  const renderPost = useCallback(({ item, index }) => {
    console.log('🔍 Rendering post with currentUser:', currentUser?.id);
    
    return (
      <View style={styles.postContainer}>
        <PostComponent
          post={item || {}}
          currentUser={currentUser || {}}
          onUpdate={handlePostUpdate}
          onDelete={handlePostDelete}
          onShare={() => handleSystemShare(item)}
          onShareCustom={() => handleShare(item)}
        />
      </View>
    );
  }, [currentUser, handlePostUpdate, handlePostDelete, handleSystemShare, handleShare]);

  const renderEmptyComponent = useCallback(() => (
    !loading && (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="restaurant-outline" size={80} color={COOKSY_COLORS.textLight} />
        </View>
        <Text style={styles.emptyTitle}>No Recipes Yet!</Text>
        <Text style={styles.emptySubtitle}>
          Be the first to share your amazing recipe with the Cooksy community
        </Text>
        <TouchableOpacity 
          style={styles.emptyButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.emptyButtonText}>Share Recipe</Text>
        </TouchableOpacity>
      </View>
    )
  ), [loading]);

  const renderLoader = useCallback(() => (
    loading && (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COOKSY_COLORS.primary} />
        <Text style={styles.loaderText}>Loading delicious recipes...</Text>
      </View>
    )
  ), [loading]);

  const ItemSeparatorComponent = useCallback(() => (
    <View style={styles.separator} />
  ), []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COOKSY_COLORS.white} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cooksy</Text>
        <View style={styles.headerButtons}>
          <Text style={styles.postsCount}>
            {posts.length} recipes
          </Text>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="search-outline" size={24} color={COOKSY_COLORS.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="notifications-outline" size={24} color={COOKSY_COLORS.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={COOKSY_COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
      
      <FlatList
        data={posts}
        keyExtractor={(item) => item._id || item.id || Math.random().toString()}
        renderItem={renderPost}
        ListHeaderComponent={renderCreatePost}
        ListEmptyComponent={renderEmptyComponent}
        ItemSeparatorComponent={ItemSeparatorComponent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[COOKSY_COLORS.primary]}
            tintColor={COOKSY_COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={3}
        getItemLayout={(data, index) => ({
          length: 400,
          offset: 400 * index,
          index,
        })}
      />

      {/* מודל יצירת פוסט מלא */}
      {showCreateModal && (
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
                <Ionicons name="close" size={24} color={COOKSY_COLORS.accent} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Share Recipe</Text>
              <View style={styles.modalPlaceholder} />
            </View>
            
            <CreatePostComponent
              onPostCreated={(newPost) => {
                handlePostCreated(newPost);
                setShowCreateModal(false);
              }}
              currentUser={currentUser}
            />
          </View>
        </Modal>
      )}

      {/* מודל שיתוף מותאם אישית */}
      {showShareModal && sharePost && (
        <SharePostComponent
          visible={showShareModal}
          onClose={handleShareModalClose}
          post={sharePost}
          onShare={handleShareSubmit}
          currentUserId={currentUser?.id}
        />
      )}

      {renderLoader()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COOKSY_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COOKSY_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COOKSY_COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COOKSY_COLORS.accent,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postsCount: {
    fontSize: 12,
    color: COOKSY_COLORS.textLight,
    marginRight: 12,
    fontWeight: '500',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: COOKSY_COLORS.background,
    borderRadius: 20,
  },
  logoutButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: COOKSY_COLORS.background,
    borderRadius: 20,
  },
  createPostContainer: {
    backgroundColor: COOKSY_COLORS.white,
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
  createPostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: COOKSY_COLORS.primary,
  },
  createPostInput: {
    flex: 1,
    backgroundColor: COOKSY_COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COOKSY_COLORS.border,
  },
  createPostPlaceholder: {
    fontSize: 16,
    color: COOKSY_COLORS.textLight,
  },
  createPostActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COOKSY_COLORS.border,
  },
  createPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COOKSY_COLORS.background,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COOKSY_COLORS.border,
  },
  createPostButtonText: {
    fontSize: 14,
    color: COOKSY_COLORS.text,
    marginLeft: 6,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COOKSY_COLORS.white,
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COOKSY_COLORS.border,
    backgroundColor: COOKSY_COLORS.white,
  },
  modalCloseButton: {
    padding: 8,
    backgroundColor: COOKSY_COLORS.background,
    borderRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COOKSY_COLORS.text,
  },
  modalPlaceholder: {
    width: 32,
  },
  postContainer: {
    backgroundColor: COOKSY_COLORS.white,
    marginHorizontal: 0,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  separator: {
    height: 8,
    backgroundColor: COOKSY_COLORS.background,
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
    color: COOKSY_COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: COOKSY_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: COOKSY_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: COOKSY_COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1000,
  },
  loaderText: {
    marginTop: 16,
    fontSize: 16,
    color: COOKSY_COLORS.textLight,
    textAlign: 'center',
  },
});

export default HomeScreen;