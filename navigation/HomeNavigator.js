import React from 'react'; 
import { createStackNavigator } from '@react-navigation/stack'; 
import HomeScreen from '../components/screens/Home/HomeScreen';
import ProfileScreen from '../components/screens/Profile/ProfileScreen';
import EditProfileScreen from '../components/screens/Profile/EditProfileScreen';
import GroupsScreen from '../components/screens/Groups/GroupsScreen';
import CreateGroupComponent from '../components/groups/CreateGroupComponent';


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
        name="CreateGroup" 
        component={CreateGroupComponent} 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />

      {/* TODO: הוסף בעתיד */}
      {/* 
      <Stack.Screen 
        name="GroupDetails" 
        component={GroupDetailsScreen} 
        options={{ 
          headerShown: false 
        }} 
      />
      */}
    </Stack.Navigator>
  );
}