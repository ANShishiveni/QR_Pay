import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Text,
  TextInput,
  Avatar,
  List,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { userAPI } from '../../config/api';
import { theme, colors, spacing } from '../../styles/theme';
import { useAuth } from '../../context/AuthContext';

export default function MyProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
  });
  const { user } = useAuth();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      if (user) {
        const response = await userAPI.getProfile();
        setUserData(response.data.user);
        setFormData({
          firstName: response.data.user.firstName || '',
          lastName: response.data.user.lastName || '',
          email: response.data.user.email || '',
          phoneNumber: response.data.user.phoneNumber || '',
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      Alert.alert('Error', 'First name and last name are required');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await userAPI.updateProfile(formData);
      setUserData(response.data.user);
      setEditMode(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const photoUri = result.assets[0].uri;
        
        // Convert image to base64
        const response = await fetch(photoUri);
        const blob = await response.blob();
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          const base64 = reader.result;
          try {
            await userAPI.uploadPhoto({ photo: base64 });
            Alert.alert('Success', 'Profile photo updated successfully');
            loadUserData(); // Reload to get updated photo
          } catch (error) {
            console.error('Error uploading photo:', error);
            Alert.alert('Error', 'Failed to update profile photo');
          }
        };
        
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'Failed to select photo');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          {userData?.photoUrl ? (
            <Image 
              source={{ uri: userData.photoUrl }} 
              style={styles.profilePhoto}
            />
          ) : (
            <Avatar.Text
              size={80}
              label={`${userData?.firstName?.[0] || ''}${userData?.lastName?.[0] || ''}`}
              style={styles.avatar}
            />
          )}
          <Title style={styles.userName}>
            {userData?.firstName} {userData?.lastName}
          </Title>
          <Paragraph style={styles.userEmail}>{userData?.email}</Paragraph>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Profile Actions */}
        <Card style={styles.actionCard}>
          <Card.Content>
            <List.Item
              title="Change Profile Photo"
              description="Update your profile picture"
              left={(props) => <Ionicons name="camera" size={24} color={colors.primary} />}
              right={(props) => <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
              onPress={handleChangePhoto}
              style={styles.menuItem}
            />
            <Divider />
            <List.Item
              title={editMode ? "Cancel Edit" : "Update Details"}
              description={editMode ? "Cancel editing" : "Edit your personal information"}
              left={(props) => <Ionicons name={editMode ? "close" : "create"} size={24} color={colors.primary} />}
              right={(props) => <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
              onPress={() => setEditMode(!editMode)}
              style={styles.menuItem}
            />
          </Card.Content>
        </Card>

        {/* Profile Details */}
        <Card style={styles.detailsCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Personal Information</Title>
            
            {editMode ? (
              <View style={styles.editForm}>
                <TextInput
                  label="First Name"
                  value={formData.firstName}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, firstName: text }))}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label="Last Name"
                  value={formData.lastName}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, lastName: text }))}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label="Email"
                  value={formData.email}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                  mode="outlined"
                  keyboardType="email-address"
                  style={styles.input}
                />
                <TextInput
                  label="Phone Number"
                  value={formData.phoneNumber}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, phoneNumber: text }))}
                  mode="outlined"
                  keyboardType="phone-pad"
                  style={styles.input}
                />
                
                <Button
                  mode="contained"
                  onPress={handleUpdateProfile}
                  loading={isUpdating}
                  disabled={isUpdating}
                  style={styles.updateButton}
                >
                  {isUpdating ? 'Updating...' : 'Update Profile'}
                </Button>
              </View>
            ) : (
              <View style={styles.detailsList}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>First Name:</Text>
                  <Text style={styles.detailValue}>{userData?.firstName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last Name:</Text>
                  <Text style={styles.detailValue}>{userData?.lastName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email:</Text>
                  <Text style={styles.detailValue}>{userData?.email}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phone:</Text>
                  <Text style={styles.detailValue}>{userData?.phoneNumber || 'Not provided'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Member Since:</Text>
                  <Text style={styles.detailValue}>
                    {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'Unknown'}
                  </Text>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  headerContent: {
    alignItems: 'center',
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: spacing.md,
  },
  avatar: {
    marginBottom: spacing.md,
    backgroundColor: colors.primary,
  },
  userName: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  userEmail: {
    fontSize: 16,
    color: colors.white,
    opacity: 0.8,
  },
  content: {
    padding: spacing.lg,
  },
  actionCard: {
    elevation: 4,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  detailsCard: {
    elevation: 4,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  menuItem: {
    paddingVertical: spacing.sm,
  },
  editForm: {
    marginTop: spacing.md,
  },
  input: {
    marginBottom: spacing.md,
  },
  updateButton: {
    marginTop: spacing.md,
  },
  detailsList: {
    marginTop: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    color: colors.text,
    flex: 2,
    textAlign: 'right',
  },
});
