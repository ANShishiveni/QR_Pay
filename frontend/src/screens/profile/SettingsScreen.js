import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { userAPI } from '../../config/api';
import { colors } from '../../styles/theme';
import mfaService from '../../services/mfaService';
import toastService from '../../services/toastService';

const SettingsScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // Authentication settings state
  const [authSettings, setAuthSettings] = useState({
    smsEnabled: true,
    primaryMethod: 'sms',
  });
  const [availableMethods, setAvailableMethods] = useState([]);
  const [mfaStatus, setMfaStatus] = useState(null);

  useEffect(() => {
    loadUserProfile();
    loadAuthSettings();
  }, []);

  const loadUserProfile = async () => {
    try {
      const response = await userAPI.getProfile();
      setUser(response.data.user);
    } catch (error) {
      console.error('Error loading profile:', error);
      toastService.error('Error', 'Failed to load profile');
    }
  };

  const loadAuthSettings = async () => {
    try {
      setLoading(true);
      
      // Initialize MFA service
      await mfaService.initialize();
      
      // Get MFA status
      const status = await mfaService.getStatus();
      setMfaStatus(status);
      
      if (status.success) {
        setAuthSettings(status.preferences);
        setAvailableMethods(status.availableMethods);
      }
    } catch (error) {
      console.error('Error loading auth settings:', error);
      toastService.error('Error', 'Failed to load authentication settings');
    } finally {
      setLoading(false);
    }
  };

  const requestImagePickerPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toastService.error('Permission Required', 'We need access to your photo library to upload a profile picture.');
      return false;
    }
    return true;
  };

  // Authentication settings handlers

  const handlePrimaryMethodChange = async (method) => {
    try {
      setLoading(true);
      setAuthSettings(prev => ({ ...prev, primaryMethod: method }));
      await mfaService.updatePreferences({ primaryMethod: method });
      toastService.success('Success', `Primary authentication method changed to ${method}`);
    } catch (error) {
      console.error('Error changing primary method:', error);
      toastService.error('Error', 'Failed to update primary authentication method');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordData;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toastService.error('Validation Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toastService.error('Validation Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toastService.error('Validation Error', 'New password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      await userAPI.changePassword({
        currentPassword,
        newPassword,
      });

      toastService.success('Success', 'Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Error changing password:', error);
      const errorMessage = error.response?.data?.error || 'Failed to change password';
      toastService.error('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Password Change Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Change Password</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={passwordData.currentPassword}
              onChangeText={(text) => setPasswordData(prev => ({ ...prev, currentPassword: text }))}
              placeholder="Enter current password"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              value={passwordData.newPassword}
              onChangeText={(text) => setPasswordData(prev => ({ ...prev, newPassword: text }))}
              placeholder="Enter new password"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={passwordData.confirmPassword}
              onChangeText={(text) => setPasswordData(prev => ({ ...prev, confirmPassword: text }))}
              placeholder="Confirm new password"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.changePasswordButton, loading && styles.disabledButton]}
            onPress={handlePasswordChange}
            disabled={loading}
          >
            <Text style={styles.changePasswordText}>
              {loading ? 'Changing...' : 'Change Password'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Authentication Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Authentication Settings</Text>
          
          {/* SMS OTP */}
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="chatbubble" size={24} color={colors.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>SMS OTP</Text>
                <Text style={styles.settingDescription}>
                  Receive verification codes via SMS for secure payments
                </Text>
              </View>
            </View>
            <Switch
              value={authSettings.smsEnabled}
              onValueChange={(enabled) => {
                setAuthSettings(prev => ({ ...prev, smsEnabled: enabled }));
                mfaService.updatePreferences({ smsEnabled: enabled });
              }}
              disabled={loading}
              trackColor={{ false: colors.gray, true: colors.primary }}
              thumbColor={authSettings.smsEnabled ? colors.white : colors.lightGray}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 20,
  },
  photoSection: {
    alignItems: 'center',
  },
  photoContainer: {
    marginBottom: 20,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.gray,
  },
  placeholderPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  changePhotoText: {
    color: colors.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
  changePasswordButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: colors.gray,
  },
  changePasswordText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  // Authentication settings styles
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.gray,
    lineHeight: 18,
  },
  methodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    minWidth: 120,
  },
  methodText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginRight: 8,
  },
});

export default SettingsScreen;
