import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  SafeAreaView
} from 'react-native';

// פתרון פשוט - תחליף לאיקונים ללא ספריות חיצוניות
const SimpleIcon = ({ type, size = 24, color = '#333' }) => {
  const icons = {
    close: '✕',
    check: '✓',
    circle: '○',
    search: '🔍'
  };
  
  return (
    <Text style={{ fontSize: size, color, fontWeight: 'bold' }}>
      {icons[type] || '●'}
    </Text>
  );
};

const SharePostComponent = ({ 
  visible, 
  onClose, 
  post, 
  onShare, 
  currentUserId 
}) => {
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [filteredFriends, setFilteredFriends] = useState([]);

  useEffect(() => {
    const fetchFriends = async () => {
      setTimeout(() => {
        // TODO: בהמשך הפרויקט - לטעון חברים אמיתיים מהשרת
        // const response = await api.get(`/users/${currentUserId}/friends`);
        // const realFriends = response.data;
        
        // כרגע רשימה ריקה כי אין חברים במשתמש
        const realFriends = [];
        
        setFriends(realFriends);
        setFilteredFriends(realFriends);
        setLoading(false);
      }, 500); // זמן קצר יותר כיוון שאין נתונים לטעון
    };

    if (visible) {
      fetchFriends();
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredFriends(friends);
    } else {
      const filtered = friends.filter(friend => 
        friend.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFriends(filtered);
    }
  }, [searchQuery, friends]);

  const toggleFriendSelection = (friendId) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter(id => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  const selectAllFriends = () => {
    if (selectedFriends.length === filteredFriends.length) {
      setSelectedFriends([]);
    } else {
      setSelectedFriends(filteredFriends.map(friend => friend.id));
    }
  };

  const handleShare = () => {
    if (selectedFriends.length === 0) {
      Alert.alert('Error', 'Please select at least one friend to share with.');
      return;
    }

    // כרגע אין חברים, אז זה לא יקרה
    // בהמשך הפרויקט כשיהיו חברים אמיתיים זה יעבוד
    if (post.privacy === 'private' && post.userId !== currentUserId) {
      Alert.alert('Cannot share', 'This post is private and cannot be shared.');
      return;
    }

    const shareData = {
      postId: post.id,
      recipients: selectedFriends,
      message: message,
      sharedAt: new Date().toISOString(),
      sharedBy: currentUserId
    };

    // TODO: בהמשך הפרויקט - לשלוח לשרת
    // await api.post('/share-post', shareData);

    if (onShare) {
      onShare(shareData);
    }

    setSelectedFriends([]);
    setMessage('');
    
    if (onClose) {
      onClose();
    }

    Alert.alert('Success', 'Post shared successfully!');
  };
  
  const renderFriendItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.friendItem,
        selectedFriends.includes(item.id) && styles.selectedFriendItem
      ]}
      onPress={() => toggleFriendSelection(item.id)}
    >
      <View style={styles.friendInfo}>
        <Image source={{ uri: item.avatar }} style={styles.friendAvatar} />
        <Text style={styles.friendName}>{item.name}</Text>
      </View>
      
      <View style={styles.rightSection}>
        {item.status === 'online' && (
          <View style={styles.onlineIndicator} />
        )}
        <SimpleIcon 
          type={selectedFriends.includes(item.id) ? "check" : "circle"} 
          size={24} 
          color={selectedFriends.includes(item.id) ? "#075eec" : "#ddd"} 
        />
      </View>
    </TouchableOpacity>
  );

  const renderPostPreview = () => (
    <View style={styles.postPreview}>
      <View style={styles.previewHeader}>
        <Text style={styles.previewTitle}>Preview</Text>
      </View>
      <View style={styles.previewContent}>
        {post.image && (
          <Image source={{ uri: post.image }} style={styles.previewImage} />
        )}
        <Text numberOfLines={2} style={styles.previewText}>
          {post.text}
        </Text>
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <SimpleIcon type="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Post</Text>
          <TouchableOpacity 
            onPress={handleShare} 
            disabled={selectedFriends.length === 0}
            style={[
              styles.shareButton,
              selectedFriends.length === 0 && styles.disabledButton
            ]}
          >
            <Text style={[
              styles.shareButtonText,
              selectedFriends.length === 0 && styles.disabledButtonText
            ]}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Post Preview */}
        {renderPostPreview()}

        {/* Share Message */}
        <View style={styles.messageContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Add a message..."
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={200}
          />
        </View>

        {/* Friends Selection */}
        <View style={styles.friendsContainer}>
          <View style={styles.friendsHeader}>
            <Text style={styles.sectionTitle}>Share with</Text>
            <TouchableOpacity onPress={selectAllFriends}>
              <Text style={styles.selectAllText}>
                {selectedFriends.length === filteredFriends.length 
                  ? "Deselect All" 
                  : "Select All"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <SimpleIcon type="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Friends List */}
          {loading ? (
            <ActivityIndicator size="large" color="#075eec" style={styles.loader} />
          ) : (
            <FlatList
              data={filteredFriends}
              keyExtractor={(item) => item.id}
              renderItem={renderFriendItem}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {searchQuery ? "No friends match your search" : "You don't have any friends yet"}
                  </Text>
                  <Text style={styles.emptySubText}>
                    {!searchQuery && "Add friends to start sharing posts with them!"}
                  </Text>
                </View>
              }
            />
          )}
        </View>

        {/* Selection Counter */}
        {selectedFriends.length > 0 && (
          <View style={styles.selectionCounter}>
            <Text style={styles.counterText}>
              {selectedFriends.length} {selectedFriends.length === 1 ? 'friend' : 'friends'} selected
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  shareButton: {
    backgroundColor: '#075eec',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    backgroundColor: '#e1e1e1',
  },
  disabledButtonText: {
    color: '#999',
  },
  postPreview: {
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
    padding: 15,
  },
  previewHeader: {
    marginBottom: 10,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 5,
    marginRight: 10,
  },
  previewText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  messageContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  messageInput: {
    fontSize: 15,
    minHeight: 40,
    maxHeight: 80,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    textAlignVertical: 'center',
  },
  friendsContainer: {
    flex: 1,
    padding: 15,
  },
  friendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectAllText: {
    fontSize: 14,
    color: '#075eec',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 15,
    marginLeft: 10,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
  },
  selectedFriendItem: {
    backgroundColor: '#f0f7ff',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 10,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4caf50',
    marginRight: 10,
  },
  loader: {
    marginTop: 40,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptySubText: {
    textAlign: 'center',
    marginTop: 8,
    color: '#bbb',
    fontSize: 14,
  },
  selectionCounter: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#075eec',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  counterText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default SharePostComponent;