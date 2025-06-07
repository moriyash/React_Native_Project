import React from 'react'; 
import { createStackNavigator } from '@react-navigation/stack'; 
import HomeScreen from '../components/screens/Home/HomeScreen';
import ProfileScreen from '../components/screens/Profile/ProfileScreen';
import EditProfileScreen from '../components/screens/Profile/EditProfileScreen';
import CreateGroupComponent from '../components/groups/CreateGroupComponent';
import GroupsScreen from '../components/screens/Groups/GroupsScreen';
import GroupDetailsScreen from '../components/screens/Groups/GroupDetailsScreen';
import EditPostScreen from '../components/screens/posts/EditPostScreen';

const Stack = createStackNavigator(); 

export default function HomeNavigator() { 
  return ( 
    <Stack.Navigator> 
      <Stack.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ headerShown: false }} 
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

      {/* הוספת מסכי קבוצות */}
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
    </Stack.Navigator>
  );
}