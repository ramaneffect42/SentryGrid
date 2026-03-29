import React from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';

import {APP_COLORS} from '../utils/constants';

function ScreenContainer({title, subtitle, children, scroll = true}) {
  const Wrapper = scroll ? ScrollView : View;
  const wrapperProps = scroll
    ? {contentContainerStyle: styles.content}
    : {style: styles.content};

  return (
    <SafeAreaView style={styles.shell}>
      <Wrapper {...wrapperProps}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    gap: 6,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: APP_COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: APP_COLORS.textSecondary,
    lineHeight: 20,
  },
});

export default ScreenContainer;
