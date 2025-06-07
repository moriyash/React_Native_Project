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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../services/AuthContext';
import { recipeService } from '../../../services/recipeService';
import PostComponent from '../../common/PostComponent';
import CreatePostComponent from '../../common/CreatePostComponent';
import SharePostComponent from '../../common/SharePostComponent';
import UserAvatar from '../../common/UserAvatar';
import { chatService } from '../../../services/chatServices'; // 馃啎 爪'讗讟

// 爪讘注讬 FlavorWorld
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

const HomeScreen = ({ navigation }) => {
  const { logout, currentUser, isLoading: authLoading } = useAuth();
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePost, setSharePost] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0); // 馃啎 诪讜谞讛 爪'讗讟
  
  // 诪讬讜谉 讜诪住谞谞讬诐
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMeatType, setSelectedMeatType] = useState('all');
  const [selectedCookingTime, setSelectedCookingTime] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, popular

  // 拽讟讙讜专讬讜转 讝诪讬谞讜转 - 诪讛拽讜讘抓 CreatePostComponent
  const categories = [
    'all', 'Asian', 'Italian', 'Mexican', 'Indian', 'Mediterranean', 
    'American', 'French', 'Chinese', 'Japanese', 'Thai', 
    'Middle Eastern', 'Greek', 'Spanish', 'Korean', 'Vietnamese'
  ];
  
  const meatTypes = [
    'all', 'Vegetarian', 'Vegan', 'Chicken', 'Beef', 'Pork', 
    'Fish', 'Seafood', 'Lamb', 'Turkey', 'Mixed'
  ];
  
  const cookingTimes = [
    { key: 'all', label: 'All Times' },
    { key: 'quick', label: 'Under 30 min', max: 30 },
    { key: 'medium', label: '30-60 min', min: 30, max: 60 },
    { key: 'long', label: '1-2 hours', min: 60, max: 120 },
    { key: 'very_long', label: 'Over 2 hours', min: 120 }
  ];

  // 馃啎 驻讜谞拽爪讬讜转 爪'讗讟
  const loadUnreadChatCount = useCallback(async () => {
    try {
      const result = await chatService.getUnreadChatsCount();
      if (result.success) {
        setUnreadChatCount(result.count);
      }
    } catch (error) {
      console.error('Load unread count error:', error);
    }
  }, []);

  const initializeChatService = useCallback(async () => {
    const userId = currentUser?.id || currentUser?._id;
    if (userId) {
      await chatService.initializeSocket(userId);
      loadUnreadChatCount();
    }
  }, [currentUser, loadUnreadChatCount]);

  // 馃啎 驻转讬讞转 诪住讱 讛爪'讗讟讬诐
  const handleOpenChats = useCallback(() => {
    navigation.navigate('ChatList');
  }, [navigation]);

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
        <Text style={styles.loaderText}>Loading...</Text>
      </SafeAreaView>
    );
  } 

  // 驻讜谞拽爪讬讛 诇诪讬讜谉 讜诪住谞谉
  const applyFiltersAndSort = useCallback((postsArray) => {
    let filtered = [...postsArray];

    // 诪住谞谉 拽讟讙讜专讬讛
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(post => 
        post.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // 诪住谞谉 住讜讙 讘砖专/诪讟讘讞
    if (selectedMeatType !== 'all') {
      filtered = filtered.filter(post => 
        post.meatType?.toLowerCase() === selectedMeatType.toLowerCase()
      );
    }

    // 诪住谞谉 讝诪谉 讛讻谞讛
    if (selectedCookingTime !== 'all') {
      const timeFilter = cookingTimes.find(t => t.key === selectedCookingTime);
      if (timeFilter) {
        filtered = filtered.filter(post => {
          const cookTime = parseInt(post.prepTime) || parseInt(post.preparationTime) || parseInt(post.cookingTime) || 0;
          if (timeFilter.max && timeFilter.min) {
            return cookTime >= timeFilter.min && cookTime <= timeFilter.max;
          } else if (timeFilter.max) {
            return cookTime <= timeFilter.max;
          } else if (timeFilter.min) {
            return cookTime >= timeFilter.min;
          }
          return true;
        });
      }
    }

    // 诪讬讜谉
    switch (sortBy) {
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'popular':
        filtered.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
        break;
      case 'newest':
      default:
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }

    return filtered;
  }, [selectedCategory, selectedMeatType, selectedCookingTime, sortBy]);

  // 注讚讻讜谉 讛诪住谞谉 讻讗砖专 诪砖转谞讬诐 讛驻专诪讟专讬诐
  useEffect(() => {
    const filtered = applyFiltersAndSort(posts);
    setFilteredPosts(filtered);
  }, [posts, applyFiltersAndSort]);

  const loadPosts = useCallback(async () => {
    try {
      const result = await recipeService.getAllRecipes();
      
      if (result.success) {
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
        
        setPosts(formattedPosts);
      } else {
        Alert.alert('Error', `Failed to load recipes: ${result.message}`);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to load recipes: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // 馃啎 讗转讞讜诇 爪'讗讟 讘注转 讟注讬谞转 讛拽讜诪驻讜谞谞讟讛
  useEffect(() => {
    if (currentUser?.id || currentUser?._id) {
      initializeChatService();
    }
  }, [currentUser, initializeChatService]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPosts();
    loadUnreadChatCount(); // 馃啎 专注谞谉 讙诐 讗转 诪住驻专 讛讛讜讚注讜转
  }, [loadPosts, loadUnreadChatCount]);

  const handleRefreshData = useCallback(async () => {
    try {
      const result = await recipeService.getAllRecipes();
      
      if (result.success) {
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
        
        setPosts(formattedPosts);
      }
    } catch (error) {
      console.error('Refresh error:', error);
    }
  }, []);

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
              // 馃啎 谞转拽 讗转 砖讬专讜转 讛爪'讗讟
              chatService.disconnect();
              await logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          }
        }
      ]
    );
  }, [logout]);

  const handleNavigateToProfile = () => {
    if (navigation) {
      navigation.navigate('Profile', { userId: currentUser?.id || currentUser?._id });
    }
  };

  const handleNavigateToSearch = () => {
    if (navigation) {
      navigation.navigate('Search');
    }
  };

  const clearAllFilters = () => {
    setSelectedCategory('all');
    setSelectedMeatType('all');
    setSelectedCookingTime('all');
    setSortBy('newest');
    setShowFilters(false);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (selectedCategory !== 'all') count++;
    if (selectedMeatType !== 'all') count++;
    if (selectedCookingTime !== 'all') count++;
    if (sortBy !== 'newest') count++;
    return count;
  };

  const handlePostCreated = useCallback((newPost) => {
    handleRefreshData();
  }, [handleRefreshData]);

  const handlePostDelete = useCallback(async (postId) => {
    try {
      const result = await recipeService.deleteRecipe(postId);
      
      if (result.success) {
        handleRefreshData();
        Alert.alert('Success', 'Recipe deleted successfully');
      } else {
        Alert.alert('Error', result.message || 'Failed to delete recipe');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete recipe');
    }
  }, [handleRefreshData]);

  const handleShare = useCallback((post) => {
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
    Alert.alert('Success', 'Recipe shared successfully!');
    handleShareModalClose();
  }, [handleShareModalClose]);

  const renderFilters = () => (
    showFilters && (
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {/* 诪讬讜谉 */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Sort:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[
                { key: 'newest', label: 'Newest' },
                { key: 'oldest', label: 'Oldest' },
                { key: 'popular', label: 'Popular' }
              ].map(sort => (
                <TouchableOpacity
                  key={sort.key}
                  style={[styles.filterChip, sortBy === sort.key && styles.activeFilterChip]}
                  onPress={() => setSortBy(sort.key)}
                >
                  <Text style={[styles.filterChipText, sortBy === sort.key && styles.activeFilterChipText]}>
                    {sort.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 拽讟讙讜专讬讜转 */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Category:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categories.map(category => (
                <TouchableOpacity
                  key={category}
                  style={[styles.filterChip, selectedCategory === category && styles.activeFilterChip]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[styles.filterChipText, selectedCategory === category && styles.activeFilterChipText]}>
                    {category === 'all' ? 'All' : category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 住讜讙 讘砖专/诪讟讘讞 */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Type:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {meatTypes.map(meatType => (
                <TouchableOpacity
                  key={meatType}
                  style={[styles.filterChip, selectedMeatType === meatType && styles.activeFilterChip]}
                  onPress={() => setSelectedMeatType(meatType)}
                >
                  <Text style={[styles.filterChipText, selectedMeatType === meatType && styles.activeFilterChipText]}>
                    {meatType === 'all' ? 'All' : meatType}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 讝诪谉 讛讻谞讛 */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Prep Time:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {cookingTimes.map(time => (
                <TouchableOpacity
                  key={time.key}
                  style={[styles.filterChip, selectedCookingTime === time.key && styles.activeFilterChip]}
                  onPress={() => setSelectedCookingTime(time.key)}
                >
                  <Text style={[styles.filterChipText, selectedCookingTime === time.key && styles.activeFilterChipText]}>
                    {time.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        {/* 讻驻转讜专 谞讬拽讜讬 讻诇 讛诪住谞谞讬诐 */}
        {getActiveFiltersCount() > 0 && (
          <TouchableOpacity style={styles.clearFiltersButton} onPress={clearAllFilters}>
            <Ionicons name="refresh" size={16} color={FLAVORWORLD_COLORS.white} />
            <Text style={styles.clearFiltersText}>Clear All Filters</Text>
          </TouchableOpacity>
        )}

        {/* 转讜爪讗讜转 */}
        <View style={styles.searchStats}>
          <Text style={styles.searchStatsText}>
            {getActiveFiltersCount() > 0 ? `${filteredPosts.length} recipes found` : `${posts.length} total recipes`}
          </Text>
        </View>
      </View>
    )
  );

  const renderCreatePost = useCallback(() => (
    <View style={styles.createPostContainer}>
      <View style={styles.createPostHeader}>
        <UserAvatar
          uri={currentUser?.avatar || currentUser?.userAvatar}
          name={currentUser?.fullName || currentUser?.name}
          size={40}
          onPress={handleNavigateToProfile}
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
  ), [currentUser, handleNavigateToProfile]);

  const renderPost = useCallback(({ item, index }) => {
    return (
      <View style={styles.postContainer}>
        <PostComponent
          post={item || {}}
          navigation={navigation}
          onDelete={handlePostDelete}
          onShare={() => handleSystemShare(item)}
          onShareCustom={() => handleShare(item)}
          onRefreshData={handleRefreshData}
        />
      </View>
    );
  }, [handlePostDelete, handleSystemShare, handleShare, handleRefreshData, navigation]);

  const renderEmptyComponent = useCallback(() => (
    !loading && (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons 
            name={getActiveFiltersCount() > 0 ? "options-outline" : "restaurant-outline"} 
            size={80} 
            color={FLAVORWORLD_COLORS.textLight} 
          />
        </View>
        <Text style={styles.emptyTitle}>
          {getActiveFiltersCount() > 0 ? 'No Recipes Found' : 'No Recipes Yet!'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {getActiveFiltersCount() > 0
            ? 'No recipes match your filter criteria. Try adjusting your filters.'
            : 'Be the first to share your amazing recipe with the FlavorWorld community'
          }
        </Text>
        {getActiveFiltersCount() === 0 && (
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.emptyButtonText}>Share Recipe</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  ), [loading, getActiveFiltersCount]);

  const renderLoader = useCallback(() => (
    loading && (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
        <Text style={styles.loaderText}>Loading delicious recipes...</Text>
      </View>
    )
  ), [loading]);

  const ItemSeparatorComponent = useCallback(() => (
    <View style={styles.separator} />
  ), []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={FLAVORWORLD_COLORS.white} />
      
      {/* Header 注诇讬讜谉 谞拽讬 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FlavorWorld</Text>
        <View style={styles.headerButtons}>
          {/* 讻驻转讜专 讞讬驻讜砖 */}
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleNavigateToSearch}
          >
            <Ionicons name="search-outline" size={24} color={FLAVORWORLD_COLORS.accent} />
          </TouchableOpacity>
          
          {/* 讻驻转讜专 诪住谞谞讬诐 */}
          <TouchableOpacity 
            style={[styles.headerButton, showFilters && styles.activeButton]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons 
              name="options-outline" 
              size={24} 
              color={showFilters ? FLAVORWORLD_COLORS.white : FLAVORWORLD_COLORS.accent} 
            />
            {getActiveFiltersCount() > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{getActiveFiltersCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* 讻驻转讜专 讬爪讬讗讛 */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={FLAVORWORLD_COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* 诪住谞谞讬诐 */}
      {renderFilters()}
      
      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => item._id || item.id || Math.random().toString()}
        renderItem={renderPost}
        ListHeaderComponent={!showFilters ? renderCreatePost : null}
        ListEmptyComponent={renderEmptyComponent}
        ItemSeparatorComponent={ItemSeparatorComponent}
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
        style={styles.flatListContainer}
      />

      {/* Bottom Navigation */}
      <View style={styles.bottomNavigation}>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => {/* 讛讜住祝 驻讛 诇讜讙讬拽讛 砖诇 讛转专讗讜转 */}}
        >
          <View style={styles.bottomNavIcon}>
            <Ionicons name="notifications-outline" size={24} color={FLAVORWORLD_COLORS.text} />
          </View>
          <Text style={styles.bottomNavLabel}>Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={handleNavigateToProfile}
        >
          <View style={styles.bottomNavIconProfile}>
            <UserAvatar
              uri={currentUser?.avatar || currentUser?.userAvatar}
              name={currentUser?.fullName || currentUser?.name}
              size={28}
            />
          </View>
          <Text style={styles.bottomNavLabel}>Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={handleOpenChats}
        >
          <View style={styles.bottomNavIconChat}>
            <Ionicons name="chatbubbles-outline" size={24} color={FLAVORWORLD_COLORS.white} />
            {unreadChatCount > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>
                  {unreadChatCount > 99 ? '99+' : unreadChatCount}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.bottomNavLabel, styles.bottomNavLabelActive]}>Messages</Text>
        </TouchableOpacity>
      </View>

      {/* 诪讜讚诇 讬爪讬专转 驻讜住讟 诪诇讗 */}
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
                <Ionicons name="close" size={24} color={FLAVORWORLD_COLORS.accent} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Share Recipe</Text>
              <View style={styles.modalPlaceholder} />
            </View>
            
            <CreatePostComponent
              currentUser={currentUser}
              onPostCreated={(newPost) => {
                handlePostCreated(newPost);
                setShowCreateModal(false);
              }}
            />
          </View>
        </Modal>
      )}

      {/* 诪讜讚诇 砖讬转讜祝 诪讜转讗诐 讗讬砖讬转 */}
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.accent,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    position: 'relative',
  },
  activeButton: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: FLAVORWORLD_COLORS.danger,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  flatListContainer: {
    flex: 1,
    marginBottom: 80, // 诪拽讜诐 诇bottom navigation
  },
  // Bottom Navigation Styles
  bottomNavigation: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderTopWidth: 1,
    borderTopColor: FLAVORWORLD_COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  bottomNavIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: FLAVORWORLD_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  bottomNavIconProfile: {
    marginBottom: 4,
  },
  bottomNavIconChat: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: FLAVORWORLD_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  bottomNavLabel: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
    fontWeight: '500',
  },
  bottomNavLabelActive: {
    color: FLAVORWORLD_COLORS.primary,
    fontWeight: '600',
  },
  chatBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: FLAVORWORLD_COLORS.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  chatBadgeText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 11,
    fontWeight: '600',
  },
  filtersContainer: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterGroup: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 8,
  },
  filterChip: {
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: FLAVORWORLD_COLORS.border,
  },
  activeFilterChip: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
    borderColor: FLAVORWORLD_COLORS.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.text,
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: FLAVORWORLD_COLORS.white,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FLAVORWORLD_COLORS.danger,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  clearFiltersText: {
    color: FLAVORWORLD_COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  searchStats: {
    alignItems: 'center',
    marginTop: 8,
  },
  searchStatsText: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
    fontWeight: '500',
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
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
  },
});

export default HomeScreen;