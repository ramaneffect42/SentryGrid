/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-quick-sqlite', () => ({
  open: () => ({
    executeAsync: jest.fn(async () => ({rows: []})),
    executeBatchAsync: jest.fn(async () => undefined),
  }),
}));

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({children}: {children: React.ReactNode}) => children,
}));

jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  const {Text} = require('react-native');
  const mockNavigation = {navigate: jest.fn()};

  return {
    createNativeStackNavigator: () => ({
      Navigator: ({children}: {children: React.ReactNode}) => children,
      Screen: ({component: Component, name}: {component: React.ComponentType; name: string}) => {
        const ScreenComponent = Component as React.ComponentType<any>;

        return (
          <>
            <Text>{name}</Text>
            <ScreenComponent navigation={mockNavigation} />
          </>
        );
      },
    }),
  };
});

const mockRequestStartupPermissions = jest.fn(async () => true);
const mockInitialize = jest.fn(async () => undefined);
const mockShutdown = jest.fn(async () => undefined);
const mockSubscribe = jest.fn((listener: (state: unknown) => void) => {
  listener({
    deviceId: 'test-node',
    peers: [],
    messages: [],
  });

  return jest.fn();
});

jest.mock('../src/services/PermissionsService', () => ({
  __esModule: true,
  default: {
    requestStartupPermissions: mockRequestStartupPermissions,
  },
}));

jest.mock('../src/services/meshRuntime', () => ({
  __esModule: true,
  default: {
    initialize: mockInitialize,
    shutdown: mockShutdown,
    subscribe: mockSubscribe,
    getState: () => ({
      deviceId: 'test-node',
      peers: [],
      messages: [],
    }),
    connectToPeer: jest.fn(async () => undefined),
    broadcastText: jest.fn(async () => undefined),
  },
}));

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
