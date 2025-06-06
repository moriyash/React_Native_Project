// services/AuthContext.js

import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // בדיקת סטטוס התחברות בעת טעינת האפליקציה
    const checkLoginStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const userData = await AsyncStorage.getItem('userData');
        
        if (token && userData) {
          setUserToken(token);
          setCurrentUser(JSON.parse(userData));
          setIsLoggedIn(true);
        } else {
          setUserToken(null);
          setCurrentUser(null);
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error("Error checking login status:", error);
        setUserToken(null);
        setCurrentUser(null);
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkLoginStatus();
  }, []);

  const login = async (token, userData = null) => {
    try {
      if (!token) {
        throw new Error("Token is missing during login");
      }

      console.log("📦 Login data received:", { token, userData });

      await AsyncStorage.setItem('userToken', token);

      if (userData) {
        const userToSave = {
          id: userData.id || userData._id || userData.userId,
          _id: userData._id || userData.id,
          fullName: userData.fullName || userData.name || userData.displayName,
          name: userData.name || userData.fullName,
          email: userData.email,
          avatar: userData.avatar || userData.userAvatar,
          bio: userData.bio || '',
          ...userData
        };
        
        console.log("💾 Saving user data:", userToSave);
        
        await AsyncStorage.setItem('userData', JSON.stringify(userToSave));
        setCurrentUser(userToSave);
      }

      setUserToken(token);
      setIsLoggedIn(true);
      
      console.log("✅ Login successful");
    } catch (error) {
      console.error("Error during login:", error);
      throw error;
    }
  };

  // 🆕 פונקציה לעדכון פרטי המשתמש
  const updateUserProfile = async (updatedData) => {
    try {
      if (!currentUser) {
        throw new Error("No current user to update");
      }

      console.log("🔄 Updating user profile in context:", updatedData);

      // מיזוג הנתונים החדשים עם הקיימים
      const updatedUser = {
        ...currentUser,
        ...updatedData,
        // וודא שה-ID נשמר
        id: currentUser.id,
        _id: currentUser._id,
      };

      // שמירה ב-AsyncStorage
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      
      // עדכון ה-state
      setCurrentUser(updatedUser);

      console.log("✅ User profile updated successfully in context");
      return { success: true };
    } catch (error) {
      console.error("❌ Error updating user profile in context:", error);
      return { success: false, message: error.message };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      setUserToken(null);
      setCurrentUser(null);
      setIsLoggedIn(false);
    } catch (error) {
      console.error("Error during logout:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        isLoading,
        userToken,
        currentUser,
        login,
        logout,
        updateUserProfile, // 🆕 הוספת הפונקציה החדשה
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);