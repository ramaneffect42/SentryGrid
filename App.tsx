import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StatusBar, StyleSheet, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';
import meshService from './src/services/meshRuntime';
import permissionsService from './src/services/PermissionsService';
import logger from './src/utils/logger';

function App(): React.JSX.Element {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        await permissionsService.requestStartupPermissions();
        await meshService.initialize();
      } catch (error) {
        logger.error('App bootstrap failed', error);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
      meshService.shutdown().catch(error => {
        logger.warn('Mesh shutdown failed', error);
      });
    };
  }, []);

  if (!isReady) {
    return (
      <SafeAreaView style={styles.loaderShell}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <View style={styles.loaderCard}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loaderShell: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderCard: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: '#111c34',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
