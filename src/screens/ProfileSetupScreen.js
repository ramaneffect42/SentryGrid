import React, {useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

import ScreenContainer from '../components/ScreenContainer';
import meshService from '../services/meshRuntime';
import {APP_COLORS} from '../utils/constants';

function ProfileSetupScreen({onComplete}) {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const saveProfile = async () => {
    const trimmed = name.trim();

    if (!trimmed) {
      Alert.alert('Name required', 'Please enter the name you want to show in chat.');
      return;
    }

    setIsSaving(true);

    try {
      await meshService.setDisplayName(trimmed);
      onComplete?.();
    } catch (error) {
      Alert.alert('Unable to save name', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer
      title="Welcome to SentryGrid"
      subtitle="Choose the name people nearby will see in chat. The app will still keep a hidden device ID internally.">
      <View style={styles.card}>
        <Text style={styles.title}>Your display name</Text>
        <Text style={styles.subtitle}>This name will be shown in chat bubbles and message history.</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          placeholderTextColor={APP_COLORS.textSecondary}
          style={styles.input}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={saveProfile}
        />
        <Pressable style={styles.button} onPress={saveProfile} disabled={isSaving}>
          <Text style={styles.buttonText}>{isSaving ? 'Saving...' : 'Continue'}</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: APP_COLORS.panel,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1f3355',
  },
  title: {
    color: APP_COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: APP_COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    backgroundColor: '#0b1220',
    color: APP_COLORS.textPrimary,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
  },
  button: {
    backgroundColor: APP_COLORS.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#082032',
    fontSize: 16,
    fontWeight: '800',
  },
});

export default ProfileSetupScreen;
