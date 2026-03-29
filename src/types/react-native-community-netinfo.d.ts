declare module '@react-native-community/netinfo' {
  export interface NetInfoState {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
  }

  export interface NetInfoSubscription {
    (): void;
  }

  interface NetInfoModule {
    addEventListener(listener: (state: NetInfoState) => void): NetInfoSubscription;
    fetch(): Promise<NetInfoState>;
  }

  const NetInfo: NetInfoModule;
  export default NetInfo;
}
