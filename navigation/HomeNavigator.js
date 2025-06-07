import React from 'react'; 
import { createStackNavigator } from '@react-navigation/stack'; 
import HomeScreen from '../components/screens/Home/HomeScreen';
import ProfileScreen from '../components/screens/Profile/ProfileScreen';
import EditProfileScreen from '../components/screens/Profile/EditProfileScreen';
import CreateGroupComponent from '../components/groups/CreateGroupComponent';
import GroupsScreen from '../components/screens/Groups/GroupsScreen';
import GroupDetailsScreen from '../components/screens/Groups/GroupDetailsScreen';
import EditPostScreen from '../components/screens/posts/EditPostScreen';
import SearchScreen from '../components/screens/serach/SearchScreen';
import ChatListScreen from '../components/screens/Chat/ChatListScreen';
import ChatConversationScreen from '../components/screens/Chat/ChatConversationScreen';

const Stack = createStackNavigator(); 

export default function HomeNavigator() { 
  return ( 
    <Stack.Navigator> 
      <Stack.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ headerShown: false }} 
      />
      
      {/* הוספת מסך חיפוש */}
      <Stack.Screen 
        name="Search" 
        component={SearchScreen} 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />
      
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />

      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen} 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />

      <Stack.Screen 
        name="EditPost" 
        component={EditPostScreen} 
        options={{ 
          headerShown: false 
        }}
      />

      {/* מסכי קבוצות */}
      <Stack.Screen 
        name="Groups" 
        component={GroupsScreen} 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />

      <Stack.Screen 
        name="GroupDetails" 
        component={GroupDetailsScreen} 
        options={{ 
          headerShown: false
        }} 
      />

      <Stack.Screen 
        name="CreateGroup" 
        component={CreateGroupComponent} 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />

      {/* 🆕 מסכי צ'אט */}
      <Stack.Screen 
        name="ChatList" 
        component={ChatListScreen} 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />

      <Stack.Screen 
        name="ChatConversation" 
        component={ChatConversationScreen} 
        options={{ 
          headerShown: false,
          presentation: 'card', // לא modal כדי שיהיה עם אנימציה רגילה
          animationEnabled: true
        }} 
      />
    </Stack.Navigator>
  );
}