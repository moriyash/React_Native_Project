import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { recipeService } from '../../services/recipeService';

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
};

const RECIPE_CATEGORIES = [
  'Asian', 'Italian', 'Mexican', 'Indian', 'Mediterranean', 
  'American', 'French', 'Chinese', 'Japanese', 'Thai', 
  'Middle Eastern', 'Greek', 'Spanish', 'Korean', 'Vietnamese'
];

const MEAT_TYPES = [
  'Vegetarian', 'Vegan', 'Chicken', 'Beef', 'Pork', 
  'Fish', 'Seafood', 'Lamb', 'Turkey', 'Mixed'
];

const CreatePostComponent = ({ onPostCreated, currentUser }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [category, setCategory] = useState('');
  const [meatType, setMeatType] = useState('');
  const [prepTimeHours, setPrepTimeHours] = useState('');
  const [prepTimeMinutes, setPrepTimeMinutes] = useState('');
  const [servings, setServings] = useState('');
  const [image, setImage] = useState(null);
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showMeatTypeModal, setShowMeatTypeModal] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!title || title.trim() === '') {
      newErrors.title = 'Recipe title is required';
    }
    
    if (!description || description.trim() === '') {
      newErrors.description = 'Recipe description is required';
    }
    
    if (!ingredients || ingredients.trim() === '') {
      newErrors.ingredients = 'Ingredients list is required';
    }
    
    if (!instructions || instructions.trim() === '') {
      newErrors.instructions = 'Cooking instructions are required';
    }
    
    if (!category || category.trim() === '') {
      newErrors.category = 'Recipe category is required';
    }
    
    if (!meatType || meatType.trim() === '') {
      newErrors.meatType = 'Meat type is required';
    }
    
    if (!servings || servings.trim() === '') {
      newErrors.servings = 'Number of servings is required';
    }
    
    // Validate prep time
    const hours = parseInt(prepTimeHours) || 0;
    const minutes = parseInt(prepTimeMinutes) || 0;
    if (hours === 0 && minutes === 0) {
      newErrors.prepTime = 'Preparation time is required';
    }

    // Validate servings is a number
    if (servings && isNaN(parseInt(servings))) {
      newErrors.servings = 'Servings must be a number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to add images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSubmit = async () => {
    console.log('🔍 Submitting form...');
    
    if (!validateForm()) {
      Alert.alert('Missing Information', 'Please fill in all required fields to share your delicious recipe!');
      return;
    }

    setIsLoading(true);

    try {
      const totalMinutes = (parseInt(prepTimeHours) || 0) * 60 + (parseInt(prepTimeMinutes) || 0);
      
      const recipeData = {
        title: title.trim(),
        description: description.trim(),
        ingredients: ingredients.trim(),
        instructions: instructions.trim(),
        category: category,
        meatType: meatType,
        prepTime: totalMinutes,
        servings: parseInt(servings) || 1,
        image: image ? image.uri : null,
        userId: currentUser ? currentUser.id : 'unknown',
        userName: currentUser ? (currentUser.fullName || currentUser.name || 'Anonymous Chef') : 'Anonymous Chef',
        userAvatar: currentUser ? currentUser.avatar : null
      };

      console.log('🔍 Recipe data:', recipeData);

      const result = await recipeService.createRecipe(recipeData);

      if (result && result.success) {
        Alert.alert('Recipe Shared! 🍳', 'Your delicious recipe has been shared with the Cooksy community!');
        
        // Reset form
        setTitle('');
        setDescription('');
        setIngredients('');
        setInstructions('');
        setCategory('');
        setMeatType('');
        setPrepTimeHours('');
        setPrepTimeMinutes('');
        setServings('');
        setImage(null);
        setErrors({});
        
        if (onPostCreated) {
          onPostCreated(result.data);
        }
      } else {
        Alert.alert('Upload Failed', result ? result.message : 'Failed to share recipe. Please try again.');
      }
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Connection Error', 'Unable to share recipe. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = (field) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const renderModalList = (data, onSelect, selectedValue) => (
    <FlatList
      data={data}
      keyExtractor={(item) => item}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.modalItem,
            selectedValue === item && styles.modalItemSelected
          ]}
          onPress={() => onSelect(item)}
        >
          <Text style={[
            styles.modalItemText,
            selectedValue === item && styles.modalItemTextSelected
          ]}>
            {item}
          </Text>
        </TouchableOpacity>
      )}
    />
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.form}>
        {/* Recipe Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Recipe Title *</Text>
          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              clearError('title');
            }}
            placeholder="What's cooking? Give your recipe a delicious name..."
            placeholderTextColor={COOKSY_COLORS.textLight}
          />
          {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
        </View>

        {/* Recipe Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.textArea, errors.description && styles.inputError]}
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              clearError('description');
            }}
            placeholder="Tell us about your recipe... What makes it special?"
            placeholderTextColor={COOKSY_COLORS.textLight}
            multiline
            numberOfLines={3}
          />
          {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
        </View>

        {/* Category and Meat Type Row */}
        <View style={styles.rowContainer}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Category *</Text>
            <TouchableOpacity
              style={[styles.selector, errors.category && styles.inputError]}
              onPress={() => setShowCategoryModal(true)}
            >
              <Text style={category ? styles.selectorText : styles.placeholderText}>
                {category || 'Select cuisine'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COOKSY_COLORS.accent} />
            </TouchableOpacity>
            {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
          </View>

          <View style={styles.halfWidth}>
            <Text style={styles.label}>Type *</Text>
            <TouchableOpacity
              style={[styles.selector, errors.meatType && styles.inputError]}
              onPress={() => setShowMeatTypeModal(true)}
            >
              <Text style={meatType ? styles.selectorText : styles.placeholderText}>
                {meatType || 'Select type'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COOKSY_COLORS.accent} />
            </TouchableOpacity>
            {errors.meatType && <Text style={styles.errorText}>{errors.meatType}</Text>}
          </View>
        </View>

        {/* Prep Time and Servings Row */}
        <View style={styles.rowContainer}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Prep Time *</Text>
            <View style={styles.timeContainer}>
              <TextInput
                style={[styles.timeInput, errors.prepTime && styles.inputError]}
                value={prepTimeHours}
                onChangeText={(text) => {
                  setPrepTimeHours(text);
                  clearError('prepTime');
                }}
                placeholder="0"
                placeholderTextColor={COOKSY_COLORS.textLight}
                keyboardType="numeric"
                maxLength={2}
              />
              <Text style={styles.timeLabel}>h</Text>
              <TextInput
                style={[styles.timeInput, errors.prepTime && styles.inputError]}
                value={prepTimeMinutes}
                onChangeText={(text) => {
                  setPrepTimeMinutes(text);
                  clearError('prepTime');
                }}
                placeholder="30"
                placeholderTextColor={COOKSY_COLORS.textLight}
                keyboardType="numeric"
                maxLength={2}
              />
              <Text style={styles.timeLabel}>m</Text>
            </View>
            {errors.prepTime && <Text style={styles.errorText}>{errors.prepTime}</Text>}
          </View>

          <View style={styles.halfWidth}>
            <Text style={styles.label}>Servings *</Text>
            <TextInput
              style={[styles.input, errors.servings && styles.inputError]}
              value={servings}
              onChangeText={(text) => {
                setServings(text);
                clearError('servings');
              }}
              placeholder="4"
              placeholderTextColor={COOKSY_COLORS.textLight}
              keyboardType="numeric"
              maxLength={2}
            />
            {errors.servings && <Text style={styles.errorText}>{errors.servings}</Text>}
          </View>
        </View>

        {/* Ingredients */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ingredients *</Text>
          <TextInput
            style={[styles.textArea, errors.ingredients && styles.inputError]}
            value={ingredients}
            onChangeText={(text) => {
              setIngredients(text);
              clearError('ingredients');
            }}
            placeholder="List all ingredients and quantities..."
            placeholderTextColor={COOKSY_COLORS.textLight}
            multiline
            numberOfLines={4}
          />
          {errors.ingredients && <Text style={styles.errorText}>{errors.ingredients}</Text>}
        </View>

        {/* Instructions */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Instructions *</Text>
          <TextInput
            style={[styles.textArea, errors.instructions && styles.inputError]}
            value={instructions}
            onChangeText={(text) => {
              setInstructions(text);
              clearError('instructions');
            }}
            placeholder="Share your cooking secrets... Step by step instructions"
            placeholderTextColor={COOKSY_COLORS.textLight}
            multiline
            numberOfLines={5}
          />
          {errors.instructions && <Text style={styles.errorText}>{errors.instructions}</Text>}
        </View>

        {/* Image Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Recipe Photo</Text>
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {image ? (
              <View>
                <Image source={{ uri: image.uri }} style={styles.selectedImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setImage(null)}
                >
                  <Ionicons name="close-circle" size={24} color={COOKSY_COLORS.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imagePickerPlaceholder}>
                <Ionicons name="camera-outline" size={40} color={COOKSY_COLORS.secondary} />
                <Text style={styles.imagePickerText}>Add a mouth-watering photo</Text>
                <Text style={styles.imagePickerSubtext}>Make your recipe irresistible!</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={COOKSY_COLORS.white} />
          ) : (
            <>
              <Ionicons name="restaurant" size={20} color={COOKSY_COLORS.white} style={{ marginRight: 8 }} />
              <Text style={styles.submitButtonText}>Share Recipe</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Cuisine</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color={COOKSY_COLORS.accent} />
              </TouchableOpacity>
            </View>
            {renderModalList(RECIPE_CATEGORIES, (selectedCategory) => {
              setCategory(selectedCategory);
              setShowCategoryModal(false);
              clearError('category');
            }, category)}
          </View>
        </View>
      </Modal>

      {/* Meat Type Modal */}
      <Modal
        visible={showMeatTypeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMeatTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Type</Text>
              <TouchableOpacity onPress={() => setShowMeatTypeModal(false)}>
                <Ionicons name="close" size={24} color={COOKSY_COLORS.accent} />
              </TouchableOpacity>
            </View>
            {renderModalList(MEAT_TYPES, (selectedType) => {
              setMeatType(selectedType);
              setShowMeatTypeModal(false);
              clearError('meatType');
            }, meatType)}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COOKSY_COLORS.background,
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COOKSY_COLORS.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: COOKSY_COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: COOKSY_COLORS.white,
    color: COOKSY_COLORS.text,
  },
  textArea: {
    borderWidth: 2,
    borderColor: COOKSY_COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: COOKSY_COLORS.white,
    textAlignVertical: 'top',
    minHeight: 80,
    color: COOKSY_COLORS.text,
  },
  inputError: {
    borderColor: COOKSY_COLORS.danger,
  },
  errorText: {
    color: COOKSY_COLORS.danger,
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  halfWidth: {
    width: '48%',
  },
  selector: {
    borderWidth: 2,
    borderColor: COOKSY_COLORS.border,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COOKSY_COLORS.white,
  },
  selectorText: {
    fontSize: 16,
    color: COOKSY_COLORS.text,
  },
  placeholderText: {
    fontSize: 16,
    color: COOKSY_COLORS.textLight,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    borderWidth: 2,
    borderColor: COOKSY_COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: COOKSY_COLORS.white,
    width: 50,
    textAlign: 'center',
    color: COOKSY_COLORS.text,
  },
  timeLabel: {
    fontSize: 16,
    color: COOKSY_COLORS.text,
    marginHorizontal: 8,
    fontWeight: '600',
  },
  imagePicker: {
    borderWidth: 2,
    borderColor: COOKSY_COLORS.secondary,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COOKSY_COLORS.white,
  },
  imagePickerPlaceholder: {
    alignItems: 'center',
  },
  imagePickerText: {
    fontSize: 16,
    color: COOKSY_COLORS.text,
    marginTop: 8,
    fontWeight: '600',
  },
  imagePickerSubtext: {
    fontSize: 14,
    color: COOKSY_COLORS.textLight,
    marginTop: 4,
  },
  selectedImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: COOKSY_COLORS.white,
    borderRadius: 12,
  },
  submitButton: {
    backgroundColor: COOKSY_COLORS.primary,
    borderRadius: 25,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  submitButtonDisabled: {
    backgroundColor: COOKSY_COLORS.textLight,
    elevation: 0,
    shadowOpacity: 0,
  },
  submitButtonText: {
    color: COOKSY_COLORS.white,
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COOKSY_COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COOKSY_COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COOKSY_COLORS.text,
  },
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COOKSY_COLORS.border,
  },
  modalItemSelected: {
    backgroundColor: COOKSY_COLORS.background,
  },
  modalItemText: {
    fontSize: 16,
    color: COOKSY_COLORS.text,
  },
  modalItemTextSelected: {
    color: COOKSY_COLORS.primary,
    fontWeight: '600',
  },
});

export default CreatePostComponent;