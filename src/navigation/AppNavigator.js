import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import ChatScreen from '../screens/ChatScreen';
import HomeScreen from '../screens/HomeScreen';
import NearbyDevicesScreen from '../screens/NearbyDevicesScreen';
import {APP_COLORS} from '../utils/constants';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: {
          backgroundColor: APP_COLORS.panel,
        },
        headerTintColor: APP_COLORS.textPrimary,
        contentStyle: {
          backgroundColor: APP_COLORS.background,
        },
      }}>
      <Stack.Screen name="Home" component={HomeScreen} options={{title: 'SentryGrid'}} />
      <Stack.Screen name="NearbyDevices" component={NearbyDevicesScreen} options={{title: 'Nearby Devices'}} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{title: 'Mesh Chat'}} />
    </Stack.Navigator>
  );
}

export default AppNavigator;
