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
  bio: { type: String, maxlength: 500 }, // הוספת bio
  avatar: { type: String, maxlength: 10000000 } // תמיכה בתמונות גדולות (Base64)
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

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