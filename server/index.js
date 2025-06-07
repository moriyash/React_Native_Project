require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');

const app = express();

// Multer setup for handling FormData
const upload = multer();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // for JSON requests - גדלנו בגלל תמונות
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // for form-encoded requests

// Middleware לדיבוג
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Content-Type: ${req.headers['content-type']}`);
  next();
});

// ============ GROUP POST ROUTES ============

// Create new group post
app.post('/api/groups/:groupId/posts', upload.any(), async (req, res) => {
  try {
    console.log('=== Group Post Creation Debug ===');
    console.log('Group ID:', req.params.groupId);
    console.log('MongoDB connected:', isMongoConnected());
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    // בדיקת תקינות Group ID
    if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const formData = req.body;
    console.log('Group post data received:', formData);

    // בדיקה שהמשתמש חבר בקבוצה
    const userId = formData.userId;
    const isMember = group.members.some(member => member.userId === userId);
    if (!isMember) {
      return res.status(403).json({ message: 'Only group members can post' });
    }

    // בדיקה שמותר לחברים לפרסם
    if (!group.settings.allowMemberPosts) {
      const isAdmin = group.members.some(member => 
        member.userId === userId && member.role === 'admin'
      );
      if (!isAdmin && group.creatorId !== userId) {
        return res.status(403).json({ message: 'Only admins can post in this group' });
      }
    }

    if (!formData.title || formData.title.trim() === '') {
      return res.status(400).json({ message: 'Recipe title is required' });
    }

    // טיפול בתמונה
    let imageData = null;
    if (req.files && req.files.length > 0) {
      const imageFile = req.files.find(file => 
        file.fieldname === 'image' || 
        file.mimetype.startsWith('image/')
      );
      
      if (imageFile) {
        const base64Image = imageFile.buffer.toString('base64');
        imageData = `data:${imageFile.mimetype};base64,${base64Image}`;
        console.log('Group post image converted to base64');
      }
    }

    if (!imageData && formData.image) {
      imageData = formData.image;
    }

    // יצירת פוסט הקבוצה
    const postData = {
      title: formData.title.trim(),
      description: formData.description || '',
      ingredients: formData.ingredients || '',
      instructions: formData.instructions || '',
      category: formData.category || 'General',
      meatType: formData.meatType || 'Mixed',
      prepTime: parseInt(formData.prepTime) || 0,
      servings: parseInt(formData.servings) || 1,
      image: imageData,
      userId: userId,
      groupId: req.params.groupId, // ⬅️ חשוב!
      likes: [],
      comments: [],
      isApproved: !group.settings.requireApproval || group.creatorId === userId // אוטו-אישור ליוצר
    };

    const groupPost = new GroupPost(postData);
    const savedPost = await groupPost.save();
    
    console.log('Group post saved successfully:', savedPost._id);

    // החזרת הפוסט עם נתוני המשתמש
    const user = await User.findById(savedPost.userId);
    const enrichedPost = {
      ...savedPost.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null,
      groupName: group.name
    };

    res.status(201).json(enrichedPost);
  } catch (error) {
    console.error('=== GROUP POST CREATION ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to create group post' });
  }
});

// Get all posts for a specific group
app.get('/api/groups/:groupId/posts', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // אם הקבוצה פרטית, בדוק שהמשתמש חבר
    const { userId } = req.query;
    if (group.isPrivate && userId) {
      const isMember = group.members.some(member => member.userId === userId);
      if (!isMember) {
        return res.status(403).json({ message: 'Access denied to private group' });
      }
    }

    // טען פוסטים של הקבוצה (רק מאושרים)
    const posts = await GroupPost.find({ 
      groupId: req.params.groupId,
      isApproved: true 
    }).sort({ createdAt: -1 });

    // העשרה עם נתוני המשתמש
    const enrichedPosts = await Promise.all(
      posts.map(async (post) => {
        const user = await User.findById(post.userId);
        return {
          ...post.toObject(),
          userName: user ? user.fullName : 'Unknown User',
          userAvatar: user ? user.avatar : null,
          userBio: user ? user.bio : null,
          groupName: group.name
        };
      })
    );

    res.json(enrichedPosts);
  } catch (error) {
    console.error('Get group posts error:', error);
    res.status(500).json({ message: 'Failed to fetch group posts' });
  }
});

// Delete group post
app.delete('/api/groups/:groupId/posts/:postId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId } = req.params;
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid group or post ID' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const post = await GroupPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // בדיקת הרשאות - יוצר הפוסט או אדמין של הקבוצה
    const isPostOwner = post.userId === userId;
    const isGroupAdmin = group.members.some(member => 
      member.userId === userId && member.role === 'admin'
    );
    const isGroupCreator = group.creatorId === userId;

    if (!isPostOwner && !isGroupAdmin && !isGroupCreator) {
      return res.status(403).json({ message: 'Permission denied' });
    }

    await GroupPost.findByIdAndDelete(postId);
    res.json({ message: 'Group post deleted successfully' });
  } catch (error) {
    console.error('Delete group post error:', error);
    res.status(500).json({ message: 'Failed to delete group post' });
  }
});

// ============ GROUP POST INTERACTIONS ============
// הוסף את הקוד הזה אחרי הקוד הקיים של GROUP POST ROUTES בשרת שלך

// Like group post
app.post('/api/groups/:groupId/posts/:postId/like', async (req, res) => {
  try {
    console.log('👍 Liking group post...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId } = req.params;
    const { userId } = req.body;

    // בדיקת תקינות IDs
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid group or post ID' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // בדיקה שהמשתמש חבר בקבוצה
    const isMember = group.members.some(member => member.userId === userId);
    if (!isMember) {
      return res.status(403).json({ message: 'Only group members can like posts' });
    }

    // מציאת הפוסט
    const post = await GroupPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // בדיקה שהפוסט שייך לקבוצה
    if (post.groupId !== groupId) {
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

    // בדיקה שעדיין לא עשה לייק
    if (!post.likes) post.likes = [];
    if (post.likes.includes(userId)) {
      return res.status(400).json({ message: 'Already liked this post' });
    }

    // הוספת הלייק
    post.likes.push(userId);
    await post.save();

    console.log('✅ Group post liked successfully');
    res.json({ 
      message: 'Post liked successfully',
      likes: post.likes,
      likesCount: post.likes.length 
    });

  } catch (error) {
    console.error('❌ Like group post error:', error);
    res.status(500).json({ message: 'Failed to like post' });
  }
});

// Unlike group post
app.delete('/api/groups/:groupId/posts/:postId/like', async (req, res) => {
  try {
    console.log('👎 Unliking group post...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId } = req.params;
    const { userId } = req.body;

    // בדיקת תקינות IDs
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid group or post ID' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // בדיקה שהמשתמש חבר בקבוצה
    const isMember = group.members.some(member => member.userId === userId);
    if (!isMember) {
      return res.status(403).json({ message: 'Only group members can unlike posts' });
    }

    // מציאת הפוסט
    const post = await GroupPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // בדיקה שהפוסט שייך לקבוצה
    if (post.groupId !== groupId) {
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

    // בדיקה שכבר עשה לייק
    if (!post.likes || !post.likes.includes(userId)) {
      return res.status(400).json({ message: 'Post not liked yet' });
    }

    // הסרת הלייק
    post.likes = post.likes.filter(id => id !== userId);
    await post.save();

    console.log('✅ Group post unliked successfully');
    res.json({ 
      message: 'Post unliked successfully',
      likes: post.likes,
      likesCount: post.likes.length 
    });

  } catch (error) {
    console.error('❌ Unlike group post error:', error);
    res.status(500).json({ message: 'Failed to unlike post' });
  }
});

// Add comment to group post
app.post('/api/groups/:groupId/posts/:postId/comments', async (req, res) => {
  try {
    console.log('💬 Adding comment to group post...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId } = req.params;
    const { text, userId, userName } = req.body;

    // בדיקת תקינות IDs
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid group or post ID' });
    }

    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // בדיקה שהמשתמש חבר בקבוצה
    const isMember = group.members.some(member => member.userId === userId);
    if (!isMember) {
      return res.status(403).json({ message: 'Only group members can comment on posts' });
    }

    // מציאת הפוסט
    const post = await GroupPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // בדיקה שהפוסט שייך לקבוצה
    if (post.groupId !== groupId) {
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

    // יצירת התגובה החדשה
    const newComment = {
      userId: userId,
      userName: userName || 'Anonymous User',
      text: text.trim(),
      createdAt: new Date()
    };

    // הוספת התגובה
    if (!post.comments) post.comments = [];
    post.comments.push(newComment);
    await post.save();

    console.log('✅ Comment added to group post successfully');
    res.status(201).json({ 
      message: 'Comment added successfully',
      comment: newComment,
      comments: post.comments,
      commentsCount: post.comments.length 
    });

  } catch (error) {
    console.error('❌ Add comment to group post error:', error);
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

// Delete comment from group post
app.delete('/api/groups/:groupId/posts/:postId/comments/:commentId', async (req, res) => {
  try {
    console.log('🗑️ Deleting comment from group post...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId, commentId } = req.params;
    const { userId } = req.body;

    // בדיקת תקינות IDs
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid group or post ID' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // בדיקה שהמשתמש חבר בקבוצה
    const isMember = group.members.some(member => member.userId === userId);
    if (!isMember) {
      return res.status(403).json({ message: 'Only group members can delete comments' });
    }

    // מציאת הפוסט
    const post = await GroupPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // בדיקה שהפוסט שייך לקבוצה
    if (post.groupId !== groupId) {
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

    // מציאת התגובה
    const commentIndex = post.comments.findIndex(comment => 
      comment._id.toString() === commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const comment = post.comments[commentIndex];

    // בדיקת הרשאות - יוצר התגובה או אדמין של הקבוצה
    const isCommentOwner = comment.userId === userId;
    const isGroupAdmin = group.members.some(member => 
      member.userId === userId && member.role === 'admin'
    );
    const isGroupCreator = group.creatorId === userId;

    if (!isCommentOwner && !isGroupAdmin && !isGroupCreator) {
      return res.status(403).json({ message: 'Permission denied' });
    }

    // מחיקת התגובה
    post.comments.splice(commentIndex, 1);
    await post.save();

    console.log('✅ Comment deleted from group post successfully');
    res.json({ 
      message: 'Comment deleted successfully',
      comments: post.comments,
      commentsCount: post.comments.length 
    });

  } catch (error) {
    console.error('❌ Delete comment from group post error:', error);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});

// Get group post with comments and likes (עזר לדיבוג)
app.get('/api/groups/:groupId/posts/:postId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId } = req.params;

    // בדיקת תקינות IDs
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid group or post ID' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // מציאת הפוסט
    const post = await GroupPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // בדיקה שהפוסט שייך לקבוצה
    if (post.groupId !== groupId) {
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

    // העשרה עם נתוני המשתמש
    const user = await User.findById(post.userId);
    const enrichedPost = {
      ...post.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null,
      groupName: group.name
    };

    res.json(enrichedPost);

  } catch (error) {
    console.error('Get group post error:', error);
    res.status(500).json({ message: 'Failed to fetch group post' });
  }
});

// ============ GROUP ROUTES ============

// Create new group
app.post('/api/groups', upload.any(), async (req, res) => {
  try {
    console.log('=== Create Group Debug ===');
    console.log('MongoDB connected:', isMongoConnected());
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const formData = req.body;
    console.log('Group data received:', formData);

    if (!formData.name || formData.name.trim() === '') {
      return res.status(400).json({ message: 'Group name is required' });
    }

    if (!formData.creatorId) {
      return res.status(400).json({ message: 'Creator ID is required' });
    }

    // טיפול בתמונת הקבוצה
    let imageData = null;
    if (req.files && req.files.length > 0) {
      const imageFile = req.files.find(file => 
        file.fieldname === 'image' || 
        file.mimetype.startsWith('image/')
      );
      
      if (imageFile) {
        const base64Image = imageFile.buffer.toString('base64');
        imageData = `data:${imageFile.mimetype};base64,${base64Image}`;
        console.log('Group image converted to base64');
      }
    }

    if (!imageData && formData.image) {
      imageData = formData.image;
    }

    // יצירת הקבוצה
    const groupData = {
      name: formData.name.trim(),
      description: formData.description || '',
      image: imageData,
      creatorId: formData.creatorId,
      isPrivate: formData.isPrivate === 'true' || formData.isPrivate === true,
      category: formData.category || 'General',
      rules: formData.rules || '',
      members: [{
        userId: formData.creatorId,
        role: 'admin',
        joinedAt: new Date()
      }],
      pendingRequests: [],
      settings: {
        allowMemberPosts: formData.allowMemberPosts !== 'false',
        requireApproval: formData.requireApproval !== 'false',
        allowInvites: formData.allowInvites !== 'false'
      }
    };

    const group = new Group(groupData);
    const savedGroup = await group.save();
    
    console.log('Group created successfully:', savedGroup._id);

    // החזרת הקבוצה עם נתוני היוצר
    const creator = await User.findById(savedGroup.creatorId);
    const enrichedGroup = {
      ...savedGroup.toObject(),
      creatorName: creator ? creator.fullName : 'Unknown',
      creatorAvatar: creator ? creator.avatar : null,
      membersCount: savedGroup.members.length,
      postsCount: 0
    };

    res.status(201).json(enrichedGroup);
  } catch (error) {
    console.error('=== CREATE GROUP ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to create group' });
  }
});

// Get all groups (public + user's private groups)
app.get('/api/groups', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.query;
    
    let groups;
    if (userId) {
      // קבוצות ציבוריות + קבוצות פרטיות שהמשתמש חבר בהן
      groups = await Group.find({
        $or: [
          { isPrivate: false },
          { 'members.userId': userId }
        ]
      }).sort({ createdAt: -1 });
    } else {
      // רק קבוצות ציבוריות
      groups = await Group.find({ isPrivate: false }).sort({ createdAt: -1 });
    }

    // העשרה עם נתונים נוספים
    const enrichedGroups = await Promise.all(
      groups.map(async (group) => {
        const creator = await User.findById(group.creatorId);
        const postsCount = await GroupPost.countDocuments({ groupId: group._id });
        
        return {
          ...group.toObject(),
          creatorName: creator ? creator.fullName : 'Unknown',
          creatorAvatar: creator ? creator.avatar : null,
          membersCount: group.members.length,
          postsCount: postsCount
        };
      })
    );

    res.json(enrichedGroups);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ message: 'Failed to fetch groups' });
  }
});

// Get single group with details
app.get('/api/groups/:id', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // העשרה עם נתונים
    const creator = await User.findById(group.creatorId);
    const postsCount = await GroupPost.countDocuments({ groupId: group._id });
    
    // רשימת חברים עם פרטים
    const membersDetails = await Promise.all(
      group.members.map(async (member) => {
        const user = await User.findById(member.userId);
        return {
          ...member.toObject(),
          userName: user ? user.fullName : 'Unknown',
          userAvatar: user ? user.avatar : null
        };
      })
    );

    const enrichedGroup = {
      ...group.toObject(),
      creatorName: creator ? creator.fullName : 'Unknown',
      creatorAvatar: creator ? creator.avatar : null,
      membersCount: group.members.length,
      postsCount: postsCount,
      membersDetails: membersDetails
    };

    res.json(enrichedGroup);
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ message: 'Failed to fetch group' });
  }
});

// Join group (request to join)
app.post('/api/groups/:id/join', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // בדיקה אם כבר חבר
    const isMember = group.members.some(member => member.userId === userId);
    if (isMember) {
      return res.status(400).json({ message: 'Already a member of this group' });
    }

    // בדיקה אם כבר יש בקשה ממתינה
    const hasPendingRequest = group.pendingRequests.some(request => request.userId === userId);
    if (hasPendingRequest) {
      return res.status(400).json({ message: 'Join request already pending' });
    }

    if (group.isPrivate && group.settings.requireApproval) {
      // הוספה לרשימת ממתינים
      group.pendingRequests.push({
        userId: userId,
        requestedAt: new Date()
      });
      await group.save();
      
      res.json({ message: 'Join request sent successfully', status: 'pending' });
    } else {
      // הצטרפות ישירה
      group.members.push({
        userId: userId,
        role: 'member',
        joinedAt: new Date()
      });
      await group.save();
      
      res.json({ message: 'Joined group successfully', status: 'joined' });
    }
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ message: 'Failed to join group' });
  }
});

// Approve/Reject join request (admin only)
app.put('/api/groups/:id/requests/:userId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { action, adminId } = req.body; // action: 'approve' or 'reject'
    
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // בדיקת הרשאות אדמין
    const isAdmin = group.members.some(member => 
      member.userId === adminId && member.role === 'admin'
    );
    if (!isAdmin) {
      return res.status(403).json({ message: 'Admin privileges required' });
    }

    const { userId } = req.params;
    
    // מציאת הבקשה
    const requestIndex = group.pendingRequests.findIndex(request => request.userId === userId);
    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Join request not found' });
    }

    // הסרת הבקשה מהרשימה
    group.pendingRequests.splice(requestIndex, 1);

    if (action === 'approve') {
      // הוספה כחבר
      group.members.push({
        userId: userId,
        role: 'member',
        joinedAt: new Date()
      });
    }

    await group.save();
    
    const message = action === 'approve' ? 'User approved successfully' : 'User rejected successfully';
    res.json({ message, action });
  } catch (error) {
    console.error('Handle request error:', error);
    res.status(500).json({ message: 'Failed to handle request' });
  }
});

// Leave group
app.delete('/api/groups/:id/members/:userId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const { userId } = req.params;
    
    // לא ניתן להסיר את היוצר
    if (group.creatorId === userId) {
      return res.status(400).json({ message: 'Group creator cannot leave the group' });
    }

    // הסרת החבר
    group.members = group.members.filter(member => member.userId !== userId);
    await group.save();
    
    res.json({ message: 'Left group successfully' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ message: 'Failed to leave group' });
  }
});

// Delete group (creator only)
app.delete('/api/groups/:id', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.body;
    
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.creatorId !== userId) {
      return res.status(403).json({ message: 'Only group creator can delete the group' });
    }

    // מחיקת כל הפוסטים של הקבוצה
    await GroupPost.deleteMany({ groupId: req.params.id });
    
    // מחיקת הקבוצה
    await Group.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ message: 'Failed to delete group' });
  }
});

// Get user profile
app.get('/api/user/profile/:userId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: { 
        id: user._id, 
        fullName: user.fullName, 
        email: user.email, 
        bio: user.bio,
        avatar: user.avatar 
      }
    });
    
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to get profile' });
  }
});

// Delete recipe
app.delete('/api/recipes/:id', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    // בדיקת תקינות ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const deletedRecipe = await Recipe.findByIdAndDelete(req.params.id);
    if (!deletedRecipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({ message: 'Failed to delete recipe' });
  }
});

// MongoDB connection - עם טיפול יותר טוב בשגיאות
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => {
      console.log('MongoDB Connection Error:', err);
      // לא נקריס את האפליקציה אם מונגו לא מתחבר
    });
} else {
  console.log('MONGODB_URI not found - running without database');
}

// User schema - עם הוספת avatar ו-bio
const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  bio: { type: String, maxlength: 500 },
  avatar: { type: String, maxlength: 10000000 },
  followers: [{ type: String }], // ⬅️ הוסף את השורה הזאת
  following: [{ type: String }]  // ⬅️ הוסף את השורה הזאת
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

// Group schema - מערכת קבוצות
const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  image: { type: String, maxlength: 10000000 }, // תמונת נושא של הקבוצה
  creatorId: { type: String, required: true }, // יוצר הקבוצה
  isPrivate: { type: Boolean, default: false }, // קבוצה פרטית או ציבורית
  category: { type: String, default: 'General' }, // קטגוריית הקבוצה
  members: [{
    userId: String,
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  pendingRequests: [{ // בקשות להצטרפות
    userId: String,
    requestedAt: { type: Date, default: Date.now }
  }],
  rules: { type: String, maxlength: 1000 }, // חוקי הקבוצה
  settings: {
    allowMemberPosts: { type: Boolean, default: true },
    requireApproval: { type: Boolean, default: true },
    allowInvites: { type: Boolean, default: true }
  }
}, { timestamps: true });

const Group = mongoose.model('Group', GroupSchema);

// GroupPost schema - פוסטים של קבוצות
const GroupPostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  ingredients: String,
  instructions: String,
  category: { type: String, default: 'General' },
  meatType: { type: String, default: 'Mixed' },
  prepTime: { type: Number, default: 0 },
  servings: { type: Number, default: 1 },
  image: { type: String, maxlength: 10000000 },
  userId: { type: String, required: true },
  groupId: { type: String, required: true }, // שייך לקבוצה ספציפית
  likes: [{ type: String }],
  comments: [{
    userId: String,
    userName: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  isApproved: { type: Boolean, default: false } // צריך אישור אדמין
}, { timestamps: true });

const GroupPost = mongoose.model('GroupPost', GroupPostSchema);

// Recipe schema - עם reference למשתמש במקום שכפול נתונים
const RecipeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  ingredients: String,
  instructions: String,
  category: { type: String, default: 'General' },
  meatType: { type: String, default: 'Mixed' },
  prepTime: { type: Number, default: 0 },
  servings: { type: Number, default: 1 },
  image: { type: String, maxlength: 10000000 }, // תמיכה בתמונות גדולות (Base64)
  userId: { type: String, required: true }, // רק reference למשתמש
  // הסרתי userName ו-userAvatar - נטען בזמן אמת
  likes: [{ type: String }],
  comments: [{
    userId: String,
    userName: String, // זה נשאר לתגובות כי זה פחות קריטי
    text: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const Recipe = mongoose.model('Recipe', RecipeSchema);

// Helper function לבדיקה אם מונגו זמין
const isMongoConnected = () => {
  return mongoose.connection.readyState === 1;
};

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { fullName, email, password } = req.body;
    
    // בדיקת נתונים נדרשים
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({ fullName, email, password });
    await user.save();

    res.status(201).json({
      message: 'User registered successfully',
      data: { 
        token: 'dummy-token-' + user._id,
        user: { id: user._id, fullName, email, bio: user.bio, avatar: user.avatar }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'Email already exists' });
    } else {
      res.status(500).json({ message: 'Registration failed' });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    const user = await User.findOne({ email, password });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    res.json({
      message: 'Login successful',
      data: { 
        token: 'dummy-token-' + user._id,
        user: { id: user._id, fullName: user.fullName, email: user.email, bio: user.bio, avatar: user.avatar }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/api/auth/forgotpassword', async (req, res) => {
  res.json({ message: 'Password reset instructions sent' });
});

// Avatar upload endpoint
app.post('/api/upload/avatar', upload.single('avatar'), async (req, res) => {
  try {
    console.log('=== Avatar Upload Debug ===');
    console.log('MongoDB connected:', isMongoConnected());
    
    if (!isMongoConnected()) {
      console.log('ERROR: Database not available');
      return res.status(503).json({ error: 'Database not available' });
    }

    if (!req.file) {
      console.log('ERROR: No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File details:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // בדיקה שזה קובץ תמונה
    if (!req.file.mimetype.startsWith('image/')) {
      console.log('ERROR: File is not an image');
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    // בדיקת גודל תמונה (5MB מקסימום)
    if (req.file.size > 5 * 1024 * 1024) {
      console.log('ERROR: File too large');
      return res.status(413).json({ error: 'Image too large - maximum 5MB allowed' });
    }

    // המרה ל-Base64 (כמו בפוסטים)
    const base64Image = req.file.buffer.toString('base64');
    const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
    
    console.log('Avatar converted to base64, length:', imageData.length);
    
    // החזרת התמונה כ-Base64 - הלקוח ישמור אותה בפרופיל המשתמש
    res.json({
      success: true,
      url: imageData, // Base64 string לשמירה בפרופיל
      filename: req.file.originalname
    });
    
  } catch (error) {
    console.error('=== AVATAR UPLOAD ERROR ===');
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Alternative avatar upload endpoints (for compatibility)
app.post('/api/user/upload-avatar', upload.single('avatar'), async (req, res) => {
  try {
    console.log('Avatar upload request received (user endpoint)');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ error: 'Database not available' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image too large - maximum 5MB allowed' });
    }

    const base64Image = req.file.buffer.toString('base64');
    const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
    
    res.json({
      success: true,
      url: imageData,
      filename: req.file.originalname
    });
    
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Another alternative endpoint
app.post('/api/auth/avatar', upload.single('avatar'), async (req, res) => {
  try {
    console.log('Avatar upload request received (auth endpoint)');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ error: 'Database not available' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image too large - maximum 5MB allowed' });
    }

    const base64Image = req.file.buffer.toString('base64');
    const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
    
    res.json({
      success: true,
      url: imageData,
      filename: req.file.originalname
    });
    
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// ============ FOLLOW SYSTEM ============
// Follow a user
app.post('/api/users/:userId/follow', async (req, res) => {
  try {
    console.log('👥 Following user...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.params; // המשתמש שרוצים לעקוב אחריו
    const { followerId } = req.body; // המשתמש שעוקב

    if (!mongoose.Types.ObjectId.isValid(userId) || !followerId) {
      return res.status(400).json({ message: 'Invalid user ID or follower ID' });
    }

    if (userId === followerId) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    // בדיקה שהמשתמשים קיימים
    const [userToFollow, follower] = await Promise.all([
      User.findById(userId),
      User.findById(followerId)
    ]);

    if (!userToFollow || !follower) {
      return res.status(404).json({ message: 'User not found' });
    }

    // בדיקה שעדיין לא עוקב
    if (!userToFollow.followers) userToFollow.followers = [];
    if (!follower.following) follower.following = [];

    if (userToFollow.followers.includes(followerId)) {
      return res.status(400).json({ message: 'Already following this user' });
    }

    // הוספת המעקב
    userToFollow.followers.push(followerId);
    follower.following.push(userId);

    await Promise.all([
      userToFollow.save(),
      follower.save()
    ]);

    console.log('✅ User followed successfully');
    res.json({ 
      message: 'User followed successfully',
      followersCount: userToFollow.followers.length,
      followingCount: follower.following.length
    });

  } catch (error) {
    console.error('❌ Follow user error:', error);
    res.status(500).json({ message: 'Failed to follow user' });
  }
});

// Unfollow a user
app.delete('/api/users/:userId/follow', async (req, res) => {
  try {
    console.log('👥 Unfollowing user...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.params; // המשתמש שרוצים להפסיק לעקוב אחריו
    const { followerId } = req.body; // המשתמש שמפסיק לעקוב

    if (!mongoose.Types.ObjectId.isValid(userId) || !followerId) {
      return res.status(400).json({ message: 'Invalid user ID or follower ID' });
    }

    // בדיקה שהמשתמשים קיימים
    const [userToUnfollow, follower] = await Promise.all([
      User.findById(userId),
      User.findById(followerId)
    ]);

    if (!userToUnfollow || !follower) {
      return res.status(404).json({ message: 'User not found' });
    }

    // בדיקה שכבר עוקב
    if (!userToUnfollow.followers || !userToUnfollow.followers.includes(followerId)) {
      return res.status(400).json({ message: 'Not following this user' });
    }

    // הסרת המעקב
    userToUnfollow.followers = userToUnfollow.followers.filter(id => id !== followerId);
    follower.following = follower.following ? follower.following.filter(id => id !== userId) : [];

    await Promise.all([
      userToUnfollow.save(),
      follower.save()
    ]);

    console.log('✅ User unfollowed successfully');
    res.json({ 
      message: 'User unfollowed successfully',
      followersCount: userToUnfollow.followers.length,
      followingCount: follower.following.length
    });

  } catch (error) {
    console.error('❌ Unfollow user error:', error);
    res.status(500).json({ message: 'Failed to unfollow user' });
  }
});

// Get user's followers count and following status
app.get('/api/users/:userId/follow-status/:viewerId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId, viewerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followersCount = user.followers ? user.followers.length : 0;
    const followingCount = user.following ? user.following.length : 0;
    const isFollowing = viewerId && user.followers ? user.followers.includes(viewerId) : false;

    res.json({
      followersCount,
      followingCount,
      isFollowing
    });

  } catch (error) {
    console.error('Get follow status error:', error);
    res.status(500).json({ message: 'Failed to get follow status' });
  }
});

// 3. Edit Post Endpoints - הוסף אחרי ה-FOLLOW SYSTEM:

// ============ EDIT POST ENDPOINTS ============
// Edit regular recipe
app.put('/api/recipes/:id', upload.any(), async (req, res) => {
  try {
    console.log('✏️ Editing recipe...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { id } = req.params;
    const formData = req.body;

    // בדיקת תקינות ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    // מציאת הפוסט
    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    // בדיקת הרשאות - רק יוצר הפוסט יכול לערוך
    if (recipe.userId !== formData.userId) {
      return res.status(403).json({ message: 'Permission denied' });
    }

    // טיפול בתמונה חדשה
    let imageData = recipe.image; // שמור את התמונה הקיימת כברירת מחדל
    
    if (req.files && req.files.length > 0) {
      const imageFile = req.files.find(file => 
        file.fieldname === 'image' || 
        file.mimetype.startsWith('image/')
      );
      
      if (imageFile) {
        const base64Image = imageFile.buffer.toString('base64');
        imageData = `data:${imageFile.mimetype};base64,${base64Image}`;
        console.log('New image uploaded for recipe edit');
      }
    } else if (formData.image && formData.image !== recipe.image) {
      imageData = formData.image;
    }

    // עדכון הנתונים
    const updateData = {
      title: formData.title?.trim() || recipe.title,
      description: formData.description || recipe.description,
      ingredients: formData.ingredients || recipe.ingredients,
      instructions: formData.instructions || recipe.instructions,
      category: formData.category || recipe.category,
      meatType: formData.meatType || recipe.meatType,
      prepTime: parseInt(formData.prepTime) || recipe.prepTime,
      servings: parseInt(formData.servings) || recipe.servings,
      image: imageData,
      updatedAt: new Date()
    };

    const updatedRecipe = await Recipe.findByIdAndUpdate(id, updateData, { new: true });
    
    // החזרת המתכון עם נתוני המשתמש
    const user = await User.findById(updatedRecipe.userId);
    const enrichedRecipe = {
      ...updatedRecipe.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null
    };

    console.log('✅ Recipe edited successfully');
    res.json(enrichedRecipe);

  } catch (error) {
    console.error('❌ Edit recipe error:', error);
    res.status(500).json({ message: 'Failed to edit recipe' });
  }
});

// Edit group post
app.put('/api/groups/:groupId/posts/:postId', upload.any(), async (req, res) => {
  try {
    console.log('✏️ Editing group post...');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { groupId, postId } = req.params;
    const formData = req.body;

    // בדיקת תקינות IDs
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid group or post ID' });
    }

    // בדיקה שהקבוצה קיימת
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // מציאת הפוסט
    const post = await GroupPost.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // בדיקה שהפוסט שייך לקבוצה
    if (post.groupId !== groupId) {
      return res.status(400).json({ message: 'Post does not belong to this group' });
    }

    // בדיקת הרשאות - יוצר הפוסט או אדמין של הקבוצה
    const isPostOwner = post.userId === formData.userId;
    const isGroupAdmin = group.members.some(member => 
      member.userId === formData.userId && member.role === 'admin'
    );
    const isGroupCreator = group.creatorId === formData.userId;

    if (!isPostOwner && !isGroupAdmin && !isGroupCreator) {
      return res.status(403).json({ message: 'Permission denied' });
    }

    // טיפול בתמונה חדשה
    let imageData = post.image; // שמור את התמונה הקיימת כברירת מחדל
    
    if (req.files && req.files.length > 0) {
      const imageFile = req.files.find(file => 
        file.fieldname === 'image' || 
        file.mimetype.startsWith('image/')
      );
      
      if (imageFile) {
        const base64Image = imageFile.buffer.toString('base64');
        imageData = `data:${imageFile.mimetype};base64,${base64Image}`;
        console.log('New image uploaded for group post edit');
      }
    } else if (formData.image && formData.image !== post.image) {
      imageData = formData.image;
    }

    // עדכון הנתונים
    const updateData = {
      title: formData.title?.trim() || post.title,
      description: formData.description || post.description,
      ingredients: formData.ingredients || post.ingredients,
      instructions: formData.instructions || post.instructions,
      category: formData.category || post.category,
      meatType: formData.meatType || post.meatType,
      prepTime: parseInt(formData.prepTime) || post.prepTime,
      servings: parseInt(formData.servings) || post.servings,
      image: imageData,
      updatedAt: new Date()
    };

    const updatedPost = await GroupPost.findByIdAndUpdate(postId, updateData, { new: true });
    
    // החזרת הפוסט עם נתוני המשתמש והקבוצה
    const user = await User.findById(updatedPost.userId);
    const enrichedPost = {
      ...updatedPost.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null,
      groupName: group.name
    };

    console.log('✅ Group post edited successfully');
    res.json(enrichedPost);

  } catch (error) {
    console.error('❌ Edit group post error:', error);
    res.status(500).json({ message: 'Failed to edit group post' });
  }
});

// Profile routes - עדכון פרופיל משתמש (מספר endpoints לתאימות)

// Helper function לעדכון פרופיל
const updateUserProfile = async (req, res) => {
  try {
    console.log('=== Profile Update Debug ===');
    console.log('Request body:', req.body);
    console.log('MongoDB connected:', isMongoConnected());
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId, id, fullName, email, avatar, bio } = req.body;
    const userIdToUse = userId || id; // נסה שניהם
    
    if (!userIdToUse) {
      console.log('ERROR: No user ID provided');
      return res.status(400).json({ message: 'User ID is required' });
    }

    // בדיקת תקינות ObjectId
    if (!mongoose.Types.ObjectId.isValid(userIdToUse)) {
      console.log('ERROR: Invalid user ID:', userIdToUse);
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // חיפוש המשתמש
    const user = await User.findById(userIdToUse);
    if (!user) {
      console.log('ERROR: User not found:', userIdToUse);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Found user:', user.email);

    // עדכון הנתונים
    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar; // שמירת ה-Base64 של התמונה

    console.log('Updating user profile:', {
      userId: userIdToUse,
      fullName,
      email,
      bio,
      hasAvatar: !!avatar,
      avatarLength: avatar ? avatar.length : 0
    });

    // שמירה
    await user.save();
    
    console.log('Profile updated successfully');

    res.json({
      message: 'Profile updated successfully',
      user: { 
        id: user._id, 
        fullName: user.fullName, 
        email: user.email, 
        bio: user.bio,
        avatar: user.avatar 
      }
    });
    
  } catch (error) {
    console.error('=== PROFILE UPDATE ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    
    if (error.code === 11000) {
      res.status(400).json({ message: 'Email already exists' });
    } else if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: 'Validation error', errors: validationErrors });
    } else {
      res.status(500).json({ message: 'Failed to update profile' });
    }
  }
};

// Multiple endpoints for profile update (for compatibility)
app.put('/api/user/profile', updateUserProfile);
app.patch('/api/user/profile', updateUserProfile);
app.put('/api/auth/profile', updateUserProfile);
app.patch('/api/auth/profile', updateUserProfile);
app.put('/api/auth/update-profile', updateUserProfile);
app.patch('/api/auth/update-profile', updateUserProfile);

// Change password endpoint
app.put('/api/auth/change-password', async (req, res) => {
  try {
    console.log('=== Change Password Debug ===');
    console.log('Request body:', { userId: req.body.userId, hasCurrentPassword: !!req.body.currentPassword, hasNewPassword: !!req.body.newPassword });
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId, currentPassword, newPassword } = req.body;
    
    // בדיקת נתונים נדרשים
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'User ID, current password and new password are required' });
    }

    // בדיקת תקינות ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // חיפוש המשתמש
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Found user:', user.email);

    // בדיקת הסיסמה הנוכחית
    if (user.password !== currentPassword) {
      console.log('Current password does not match');
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // בדיקת validation של הסיסמה החדשה (כמו בקומפוננטה)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        message: 'Password must contain at least 8 characters, including uppercase and lowercase letters, a number and a special character' 
      });
    }

    // עדכון הסיסמה
    user.password = newPassword;
    await user.save();
    
    console.log('Password updated successfully for user:', user.email);

    res.json({
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    console.error('=== CHANGE PASSWORD ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    
    res.status(500).json({ message: 'Failed to change password' });
  }
});

// Alternative endpoints for password change
app.patch('/api/auth/change-password', async (req, res) => {
  // Same logic as PUT endpoint
  try {
    console.log('=== Change Password Debug (PATCH) ===');
    
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId, currentPassword, newPassword } = req.body;
    
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'User ID, current password and new password are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.password !== currentPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        message: 'Password must contain at least 8 characters, including uppercase and lowercase letters, a number and a special character' 
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    console.error('Change password error (PATCH):', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

app.put('/api/user/change-password', async (req, res) => {
  // Same logic - third endpoint for compatibility
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId, currentPassword, newPassword } = req.body;
    
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'User ID, current password and new password are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.password !== currentPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        message: 'Password must contain at least 8 characters, including uppercase and lowercase letters, a number and a special character' 
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    console.error('Change password error (user endpoint):', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

app.get('/api/user/profile/:userId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const { userId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: { 
        id: user._id, 
        fullName: user.fullName, 
        email: user.email, 
        bio: user.bio,
        avatar: user.avatar 
      }
    });
    
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to get profile' });
  }
});

// Recipe routes
app.get('/api/recipes', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    // טעינת מתכונים עם נתוני המשתמש
    const recipes = await Recipe.find().sort({ createdAt: -1 });
    
    // העשרת כל מתכון עם נתוני המשתמש המעודכנים
    const enrichedRecipes = await Promise.all(
      recipes.map(async (recipe) => {
        const user = await User.findById(recipe.userId);
        return {
          ...recipe.toObject(),
          userName: user ? user.fullName : 'Unknown User',
          userAvatar: user ? user.avatar : null,
          userBio: user ? user.bio : null
        };
      })
    );

    res.json(enrichedRecipes);
  } catch (error) {
    console.error('Get recipes error:', error);
    res.status(500).json({ message: 'Failed to fetch recipes' });
  }
});

// Handle FormData with multer
app.post('/api/recipes', upload.any(), async (req, res) => {
  try {
    console.log('=== Recipe Creation Debug ===');
    console.log('MongoDB connected:', isMongoConnected());
    console.log('Content-Type:', req.headers['content-type']);
    console.log('req.body:', req.body);
    console.log('req.files length:', req.files ? req.files.length : 0);
    
    if (!isMongoConnected()) {
      console.log('ERROR: Database not available');
      return res.status(503).json({ message: 'Database not available' });
    }

    // Handle FormData - the data is now in req.body after multer processing
    const formData = req.body;
    
    // בדיקת נתונים נדרשים
    if (!formData.title || formData.title.trim() === '') {
      console.log('ERROR: Recipe title is missing, received:', formData.title);
      return res.status(400).json({ message: 'Recipe title is required' });
    }
    
    console.log('Title validation passed:', formData.title);
    
    // טיפול בתמונה
    let imageData = null;
    if (req.files && req.files.length > 0) {
      // מחפשים קובץ תמונה
      const imageFile = req.files.find(file => 
        file.fieldname === 'image' || 
        file.mimetype.startsWith('image/')
      );
      
      if (imageFile) {
        console.log('Image file found:', {
          fieldname: imageFile.fieldname,
          originalname: imageFile.originalname,
          mimetype: imageFile.mimetype,
          size: imageFile.size
        });
        
        // המרה ל-Base64
        const base64Image = imageFile.buffer.toString('base64');
        imageData = `data:${imageFile.mimetype};base64,${base64Image}`;
        console.log('Image converted to base64, length:', imageData.length);
      }
    }
    
    // אם אין קובץ אבל יש base64 בנתונים (מהפורטמט הקודם)
    if (!imageData && formData.image) {
      imageData = formData.image;
      console.log('Using image data from form field');
    }
    
    // ברירות מחדל לנתונים חסרים
    const recipeData = {
      title: formData.title.trim(),
      description: formData.description || '',
      ingredients: formData.ingredients || '',
      instructions: formData.instructions || '',
      category: formData.category || 'General',
      meatType: formData.meatType || 'Mixed',
      prepTime: parseInt(formData.prepTime) || 0,
      servings: parseInt(formData.servings) || 1,
      image: imageData, // התמונה כ-Base64 או null
      userId: formData.userId || 'anonymous', // רק ה-ID, לא שם או תמונה
      likes: [],
      comments: []
    };
    
    console.log('Creating recipe object with data (image length):', {
      ...recipeData,
      image: imageData ? `[Base64 data: ${imageData.length} chars]` : null
    });
    
    const recipe = new Recipe(recipeData);
    console.log('Recipe object created, attempting to save...');
    
    const savedRecipe = await recipe.save();
    console.log('Recipe saved successfully:', savedRecipe._id);
    
    // החזרת המתכון עם נתוני המשתמש המעודכנים
    const user = await User.findById(savedRecipe.userId);
    const enrichedRecipe = {
      ...savedRecipe.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null
    };
    
    res.status(201).json(enrichedRecipe);
  } catch (error) {
    console.error('=== RECIPE CREATION ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    
    // טיפול בשגיאות validation
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: 'Validation error', errors: validationErrors });
    } else if (error.message.includes('too large')) {
      res.status(413).json({ message: 'Image too large - please use a smaller image' });
    } else {
      res.status(500).json({ message: 'Failed to create recipe' });
    }
  }
});

// Get single recipe with user data
app.get('/api/recipes/:id', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    // העשרה עם נתוני המשתמש
    const user = await User.findById(recipe.userId);
    const enrichedRecipe = {
      ...recipe.toObject(),
      userName: user ? user.fullName : 'Unknown User',
      userAvatar: user ? user.avatar : null,
      userBio: user ? user.bio : null
    };

    res.json(enrichedRecipe);
  } catch (error) {
    console.error('Get recipe error:', error);
    res.status(500).json({ message: 'Failed to fetch recipe' });
  }
});

app.delete('/api/recipes/:id', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    // בדיקת תקינות ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const deletedRecipe = await Recipe.findByIdAndDelete(req.params.id);
    if (!deletedRecipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({ message: 'Failed to delete recipe' });
  }
});

// Comments
app.post('/api/recipes/:id/comments', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const { text, userId, userName } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const newComment = {
      userId: userId || 'anonymous',
      userName: userName || 'Anonymous User',
      text: text.trim(),
      createdAt: new Date()
    };

    if (!recipe.comments) recipe.comments = [];
    recipe.comments.push(newComment);
    
    await recipe.save();
    
    console.log('Comment added successfully to recipe:', req.params.id);
    res.status(201).json({ 
      message: 'Comment added successfully',
      comment: newComment,
      commentsCount: recipe.comments.length 
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

// Get comments for a recipe
app.get('/api/recipes/:id/comments', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    res.json(recipe.comments || []);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'Failed to get comments' });
  }
});

// Delete a comment
app.delete('/api/recipes/:id/comments/:commentId', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    recipe.comments = recipe.comments.filter(comment => 
      comment._id.toString() !== req.params.commentId
    );
    
    await recipe.save();
    
    res.json({ 
      message: 'Comment deleted successfully',
      commentsCount: recipe.comments.length 
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});

// Likes
app.post('/api/recipes/:id/like', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    if (!recipe.likes) recipe.likes = [];
    
    const userId = 'current-user-id'; // זמני - תחליפי בtoken אמיתי בעתיד
    if (!recipe.likes.includes(userId)) {
      recipe.likes.push(userId);
      await recipe.save();
    }
    
    res.json({ likesCount: recipe.likes.length });
  } catch (error) {
    console.error('Like recipe error:', error);
    res.status(500).json({ message: 'Failed to like recipe' });
  }
});

app.delete('/api/recipes/:id/like', async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Database not available' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid recipe ID' });
    }

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    
    const userId = 'current-user-id'; // זמני
    
    recipe.likes = recipe.likes.filter(id => id !== userId);
    await recipe.save();
    
    res.json({ likesCount: recipe.likes.length });
  } catch (error) {
    console.error('Unlike recipe error:', error);
    res.status(500).json({ message: 'Failed to unlike recipe' });
  }
});

// Test route
app.get('/', (req, res) => {
  res.send('Recipe Social Network API Server is running');
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    mongoConnected: isMongoConnected(),
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`MongoDB status: ${isMongoConnected() ? 'Connected' : 'Disconnected'}`);
});