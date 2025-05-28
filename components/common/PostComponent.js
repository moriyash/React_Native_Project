import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  Dimensions,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { recipeService } from '../../services/recipeService';

const { width: screenWidth } = Dimensions.get('window');

const PostComponent = ({ post, currentUser, onUpdate, onDelete, onShare }) => {
  // ✅ Safe checks - ודא שכל הנתונים קיימים
  const safePost = post || {};
  const safeCurrentUser = currentUser || {};
  
  const [isLiked, setIsLiked] = useState(
    safePost.likes?.includes(safeCurrentUser.id) || false
  );
  const [likesCount, setLikesCount] = useState(safePost.likes?.length || 0);
  const [showComments, setShowComments] = useState(false);
  const [showFullRecipe, setShowFullRecipe] = useState(false);
  const [comments, setComments] = useState(safePost.comments || []);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Debug logs
  console.log('🔍 PostComponent props:', {
    postId: safePost._id || safePost.id,
    currentUserId: safeCurrentUser.id,
    postTitle: safePost.title
  });

  const formatTime = (minutes) => {
    if (!minutes || isNaN(minutes)) return '0m';

    const numMinutes = parseInt(minutes);
    if (numMinutes < 60) {
      return `${numMinutes}m`;
    } else {
      const hours = Math.floor(numMinutes / 60);
      const remainingMinutes = numMinutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Just now';

    try {
      const date = new Date(dateString);
      const now = new Date();

      if (isNaN(date.getTime())) {
        return 'Just now';
      }

      const diffInMs = now - date;
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

      if (diffInHours < 1) {
        return 'Just now';
      } else if (diffInHours < 24) {
        return `${diffInHours}h ago`;
      } else {
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
      }
    } catch (error) {
      return 'Just now';
    }
  };

  const handleLike = async () => {
    // ✅ Safe checks
    if (!safePost._id && !safePost.id) {
      console.error('❌ No post ID found');
      return;
    }

    const postId = safePost._id || safePost.id;

    try {
      if (isLiked) {
        const result = await recipeService.unlikeRecipe(postId);
        if (result.success) {
          setIsLiked(false);
          setLikesCount(prev => Math.max(0, prev - 1));
          
          // עדכן את הפוסט בהום סקרין
          if (onUpdate) {
            onUpdate({
              ...safePost,
              likes: safePost.likes?.filter(id => id !== safeCurrentUser.id) || []
            });
          }
        }
      } else {
        const result = await recipeService.likeRecipe(postId);
        if (result.success) {
          setIsLiked(true);
          setLikesCount(prev => prev + 1);
          
          // עדכן את הפוסט בהום סקרין
          if (onUpdate) {
            onUpdate({
              ...safePost,
              likes: [...(safePost.likes || []), safeCurrentUser.id]
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Like error:', error);
      Alert.alert('Error', 'Failed to update like status');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    const postId = safePost._id || safePost.id;
    if (!postId) {
      Alert.alert('Error', 'Invalid post ID');
      return;
    }

    setIsSubmittingComment(true);

    try {
      const result = await recipeService.addComment(postId, {
        text: newComment.trim(),
        userId: safeCurrentUser.id,
        userName: safeCurrentUser.fullName || safeCurrentUser.name || 'Anonymous'
      });

      if (result.success) {
        const newCommentObj = {
          _id: Date.now().toString(), // Temporary ID
          text: newComment.trim(),
          userId: safeCurrentUser.id,
          userName: safeCurrentUser.fullName || safeCurrentUser.name || 'Anonymous',
          userAvatar: safeCurrentUser.avatar,
          createdAt: new Date().toISOString()
        };

        setComments(prev => [...prev, newCommentObj]);
        setNewComment('');

        // עדכן את הפוסט בהום סקרין
        if (onUpdate) {
          onUpdate({
            ...safePost,
            comments: [...comments, newCommentObj]
          });
        }
      } else {
        Alert.alert('Error', result.message || 'Failed to add comment');
      }
    } catch (error) {
      console.error('❌ Add comment error:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    const postId = safePost._id || safePost.id;
    
    try {
      const result = await recipeService.deleteComment(postId, commentId);
      
      if (result.success) {
        setComments(prev => prev.filter(comment => comment._id !== commentId));
        
        // עדכן את הפוסט בהום סקרין
        if (onUpdate) {
          onUpdate({
            ...safePost,
            comments: comments.filter(comment => comment._id !== commentId)
          });
        }
      } else {
        Alert.alert('Error', result.message || 'Failed to delete comment');
      }
    } catch (error) {
      console.error('❌ Delete comment error:', error);
      Alert.alert('Error', 'Failed to delete comment');
    }
  };

  const handleDelete = () => {
    // ✅ Safe checks
    if (!safeCurrentUser.id || !safePost.userId) {
      Alert.alert('Error', 'Cannot determine ownership');
      return;
    }

    if (safePost.userId !== safeCurrentUser.id) {
      Alert.alert('Error', 'You can only delete your own recipes');
      return;
    }

    const postId = safePost._id || safePost.id;
    if (!postId) {
      Alert.alert('Error', 'Invalid post ID');
      return;
    }

    Alert.alert(
      'Delete Recipe',
      'Are you sure you want to delete this recipe?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (onDelete) {
              onDelete(postId);
            }
          }
        }
      ]
    );
  };

  const handleShare = () => {
    if (onShare) {
      onShare(safePost);
    }
  };

  const renderComment = ({ item }) => (
    <View style={styles.commentItem}>
      <Image 
        source={{ 
          uri: item.userAvatar || 'https://randomuser.me/api/portraits/men/32.jpg' 
        }} 
        style={styles.commentAvatar} 
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUserName}>{item.userName || 'Anonymous'}</Text>
          <Text style={styles.commentTime}>{formatDate(item.createdAt)}</Text>
          {item.userId === safeCurrentUser.id && (
            <TouchableOpacity 
              onPress={() => handleDeleteComment(item._id)}
              style={styles.deleteCommentButton}
            >
              <Ionicons name="trash-outline" size={16} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
      </View>
    </View>
  );

  const renderCommentsModal = () => (
    <Modal
      visible={showComments}
      animationType="slide"
      onRequestClose={() => setShowComments(false)}
    >
      <KeyboardAvoidingView 
        style={styles.commentsModalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.commentsHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowComments(false)}
          >
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.commentsTitle}>Comments ({comments.length})</Text>
          <View style={styles.placeholder} />
        </View>

        <FlatList
          data={comments}
          keyExtractor={(item) => item._id || item.id || Math.random().toString()}
          renderItem={renderComment}
          style={styles.commentsList}
          ListEmptyComponent={
            <View style={styles.emptyComments}>
              <Text style={styles.emptyCommentsText}>No comments yet</Text>
              <Text style={styles.emptyCommentsSubtext}>Be the first to comment!</Text>
            </View>
          }
        />

        <View style={styles.addCommentContainer}>
          <Image 
            source={{ 
              uri: safeCurrentUser.avatar || 'https://randomuser.me/api/portraits/men/32.jpg' 
            }} 
            style={styles.addCommentAvatar} 
          />
          <TextInput
            style={styles.addCommentInput}
            placeholder="Write a comment..."
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.addCommentButton,
              (!newComment.trim() || isSubmittingComment) && styles.addCommentButtonDisabled
            ]}
            onPress={handleAddComment}
            disabled={!newComment.trim() || isSubmittingComment}
          >
            {isSubmittingComment ? (
              <ActivityIndicator size="small" color="#0866ff" />
            ) : (
              <Ionicons name="send" size={20} color="#0866ff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderFullRecipeModal = () => (
    <Modal
      visible={showFullRecipe}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setShowFullRecipe(false)}
    >
      <View style={styles.fullRecipeContainer}>
        <View style={styles.fullRecipeHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowFullRecipe(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.fullRecipeTitle} numberOfLines={2}>
            {safePost.title || 'Untitled Recipe'}
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContainer}>
          {safePost.image && (
            <Image source={{ uri: safePost.image }} style={styles.fullRecipeImage} />
          )}

          <View style={styles.fullRecipeContent}>
            <View style={styles.recipeMetaRow}>
              <View style={styles.recipeMeta}>
                <Ionicons name="time-outline" size={16} color="#666" />
                <Text style={styles.recipeMetaText}>{formatTime(safePost.prepTime)}</Text>
              </View>
              <View style={styles.recipeMeta}>
                <Ionicons name="people-outline" size={16} color="#666" />
                <Text style={styles.recipeMetaText}>{safePost.servings || 0} servings</Text>
              </View>
              <View style={styles.recipeMeta}>
                <Text style={styles.categoryTag}>{safePost.category || 'General'}</Text>
              </View>
            </View>

            <Text style={styles.fullRecipeDescription}>
              {safePost.description || 'No description available'}
            </Text>

            <View style={styles.recipeSection}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              <Text style={styles.sectionContent}>
                {safePost.ingredients || 'No ingredients listed'}
              </Text>
            </View>

            <View style={styles.recipeSection}>
              <Text style={styles.sectionTitle}>Instructions</Text>
              <Text style={styles.sectionContent}>
                {safePost.instructions || 'No instructions provided'}
              </Text>
            </View>
            
            <View style={{ height: 100 }} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Post Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image
            source={{ 
              uri: safePost.userAvatar || 'https://randomuser.me/api/portraits/men/32.jpg' 
            }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.userName}>
              {safePost.userName || 'Anonymous Chef'}
            </Text>
            <Text style={styles.timeStamp}>
              {formatDate(safePost.createdAt)}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#65676b" />
        </TouchableOpacity>
      </View>

      {/* Recipe Content */}
      <TouchableOpacity onPress={() => setShowFullRecipe(true)}>
        <Text style={styles.recipeTitle}>
          {safePost.title || 'Untitled Recipe'}
        </Text>
        <Text style={styles.recipeDescription} numberOfLines={2}>
          {safePost.description || 'No description available'}
        </Text>

        <View style={styles.recipeInfo}>
          <View style={styles.recipeInfoItem}>
            <Ionicons name="time-outline" size={16} color="#FF6B35" />
            <Text style={styles.recipeInfoText}>
              {formatTime(safePost.prepTime)}
            </Text>
          </View>
          <View style={styles.recipeInfoItem}>
            <Ionicons name="people-outline" size={16} color="#FF6B35" />
            <Text style={styles.recipeInfoText}>
              {safePost.servings || 0} servings
            </Text>
          </View>
          <View style={styles.categoryContainer}>
            <Text style={styles.categoryTag}>
              {safePost.category || 'General'}
            </Text>
            <Text style={styles.meatTypeTag}>
              {safePost.meatType || 'Mixed'}
            </Text>
          </View>
        </View>

        {safePost.image && (
          <Image source={{ uri: safePost.image }} style={styles.recipeImage} />
        )}
      </TouchableOpacity>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={20}
            color={isLiked ? "#FF3B30" : "#65676b"}
          />
          <Text style={[styles.actionText, isLiked && styles.likedText]}>
            {likesCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowComments(true)}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#65676b" />
          <Text style={styles.actionText}>{comments.length}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="#65676b" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>

        {safeCurrentUser.id && safePost.userId === safeCurrentUser.id && (
          <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>

      {renderCommentsModal()}
      {renderFullRecipeModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginBottom: 8,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  timeStamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  recipeDescription: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 16,
    marginBottom: 12,
    lineHeight: 20,
  },
  recipeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  recipeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  recipeInfoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryTag: {
    fontSize: 12,
    color: '#0866ff',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  meatTypeTag: {
    fontSize: 12,
    color: '#4caf50',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recipeImage: {
    width: screenWidth,
    height: 200,
    resizeMode: 'cover',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionText: {
    fontSize: 14,
    color: '#65676b',
    marginLeft: 4,
  },
  likedText: {
    color: '#FF3B30',
  },
  
  // Comments Modal Styles
  commentsModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  commentTime: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  deleteCommentButton: {
    padding: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCommentsText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    color: '#999',
  },
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  addCommentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  addCommentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
  },
  addCommentButton: {
    marginLeft: 8,
    padding: 8,
  },
  addCommentButtonDisabled: {
    opacity: 0.5,
  },
  
  // Full Recipe Modal Styles
  fullRecipeContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  fullRecipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  closeButton: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 25,
    position: 'absolute',
    right: 16,
    top: 16,
    zIndex: 1001,
  },
  fullRecipeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 60,
    marginLeft: 0,
    textAlign: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  fullRecipeImage: {
    width: screenWidth,
    height: 250,
    resizeMode: 'cover',
  },
  fullRecipeContent: {
    padding: 16,
  },
  recipeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  recipeMetaText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  fullRecipeDescription: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 20,
  },
  recipeSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
});

export default PostComponent;