import React from 'react'; 
import { createStackNavigator } from '@react-navigation/stack'; 
import HomeScreen from '../components/screens/Home/HomeScreen';
import ProfileScreen from '../components/screens/Profile/ProfileScreen';
import EditProfileScreen from '../components/screens/Profile/EditProfileScreen';


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

      {/* הוספת מסך עריכת פרופיל */}
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen} 
        options={{ 
          headerShown: false,
          presentation: 'modal'
        }} 
      />
    </Stack.Navigator>
  );
}