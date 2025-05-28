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


const HomeScreen = ({ currentUser }) => {
  const { logout } = useAuth(); // הוסף את זה
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
      
      console.log('📥 Load result:', result); // Debug
      
      if (result.success) {
        console.log('✅ Posts loaded successfully:', result.data?.length || 0);
        
        // ודא שהנתונים הם array
        const postsArray = Array.isArray(result.data) ? result.data : [];
        
        // ודא שהנתונים במבנה הנכון
        const formattedPosts = postsArray.map(post => ({
          ...post,
          _id: post._id || post.id,
          userName: post.userName || post.user?.name || post.author?.name || 'Anonymous',
          userAvatar: post.userAvatar || post.user?.avatar || post.author?.avatar || null,
          likes: Array.isArray(post.likes) ? post.likes : [],
          comments: Array.isArray(post.comments) ? post.comments : [],
          createdAt: post.createdAt || post.created_at || new Date().toISOString(),
        }));
        
        // מיין לפי תאריך יצירה (החדש ביותר ראשון)
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

  // טעינה ראשונית
  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // רענון
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPosts();
  }, [loadPosts]);

  // התנתקות
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

  // טיפול ביצירת פוסט חדש
  const handlePostCreated = useCallback((newPost) => {
    console.log('✅ New post created:', newPost);
    // הוסף את הפוסט החדש לראש הרשימה
    setPosts(prevPosts => [newPost, ...prevPosts]);
  }, []);

  // עדכון פוסט
  const handlePostUpdate = useCallback((updatedPost) => {
    console.log('📝 Post updated:', updatedPost);
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post._id === updatedPost._id ? updatedPost : post
      )
    );
  }, []);

  // מחיקת פוסט
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

  // שיתוף פוסט
  const handleShare = useCallback((post) => {
    console.log('📤 Sharing post:', post.title);
    setSharePost(post);
    setShowShareModal(true);
  }, []);

  // שיתוף מערכת
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

  // סגירת מודל שיתוף
  const handleShareModalClose = useCallback(() => {
    setShowShareModal(false);
    setSharePost(null);
  }, []);

  // אישור שיתוף
  const handleShareSubmit = useCallback((shareData) => {
    console.log('📤 Share submitted:', shareData);
    // כאן תוכל להוסיף לוגיקה לשליחת השיתוף לשרת
    Alert.alert('Success', 'Recipe shared successfully!');
    handleShareModalClose();
  }, [handleShareModalClose]);

  // רכיב יצירת פוסט מוקטן
  const renderCreatePost = useCallback(() => (
    <View style={styles.createPostContainer}>
      {/* Header קטן ליצירת פוסט */}
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
            Share a new recipe...
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.createPostActions}>
        <TouchableOpacity 
          style={styles.createPostButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="restaurant-outline" size={20} color="#FF6B35" />
          <Text style={styles.createPostButtonText}>Recipe</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.createPostButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="camera-outline" size={20} color="#4CAF50" />
          <Text style={styles.createPostButtonText}>Photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [currentUser]);

  // רכיב פוסט בודד
  const renderPost = useCallback(({ item, index }) => {
    // ✅ Debug - ודא שיש currentUser
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

  // רכיב ריק
  const renderEmptyComponent = useCallback(() => (
    !loading && (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Recipes Yet!</Text>
        <Text style={styles.emptySubtitle}>
          Be the first to share your amazing recipe with the community
        </Text>
      </View>
    )
  ), [loading]);

  // רכיב טעינה
  const renderLoader = useCallback(() => (
    loading && (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0866ff" />
        <Text style={styles.loaderText}>Loading delicious recipes...</Text>
      </View>
    )
  ), [loading]);

  // מפריד בין פוסטים
  const ItemSeparatorComponent = useCallback(() => (
    <View style={styles.separator} />
  ), []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recipe Share</Text>
        <View style={styles.headerButtons}>
          <Text style={styles.postsCount}>
            {posts.length} recipes
          </Text>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="search-outline" size={24} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="notifications-outline" size={24} color="#333" />
          </TouchableOpacity>
          {/* כפתור התנתקות */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
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
            colors={['#0866ff']}
            tintColor="#0866ff"
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={3}
        getItemLayout={(data, index) => ({
          length: 400, // גובה משוער של פוסט
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
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Share Recipe</Text>
              <View style={styles.modalPlaceholder} />
            </View>
            
            <CreatePostComponent
              onPostCreated={(newPost) => {
                handlePostCreated(newPost);
                setShowCreateModal(false); // 🔥 סגור את המודל אחרי יצירה
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

      {/* אינדיקטור טעינה */}
      {renderLoader()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postsCount: {
    fontSize: 12,
    color: '#666',
    marginRight: 12,
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  logoutButton: {
    padding: 8,
    marginLeft: 8,
  },
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  createPostContainer: {
    backgroundColor: '#fff',
    marginBottom: 8,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
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
  },
  createPostInput: {
    flex: 1,
    backgroundColor: '#f0f2f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  createPostPlaceholder: {
    fontSize: 16,
    color: '#666',
  },
  createPostActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  createPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  createPostButtonText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50, // 🔥 הוסף padding במקום SafeAreaView
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalPlaceholder: {
    width: 32,
  },
  postContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 0,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
  },
  separator: {
    height: 8,
    backgroundColor: '#f0f2f5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
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
    color: '#666',
    textAlign: 'center',
  },
});

export default HomeScreen;