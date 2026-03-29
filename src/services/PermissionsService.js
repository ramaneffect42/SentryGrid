import {PermissionsAndroid, Platform} from 'react-native';

import logger from '../utils/logger';

class PermissionsService {
  async requestStartupPermissions() {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permissions = this.getAndroidPermissions();
    const result = await PermissionsAndroid.requestMultiple(permissions);
    const denied = Object.entries(result).filter(([, value]) => value !== PermissionsAndroid.RESULTS.GRANTED);

    if (denied.length > 0) {
      logger.warn('Some permissions were denied', denied);
    }

    return denied.length === 0;
  }

  getAndroidPermissions() {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ];

    if (PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES) {
      permissions.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
    }

    return permissions;
  }
}

export default new PermissionsService();
