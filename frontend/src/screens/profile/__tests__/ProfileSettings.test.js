import React from 'react';
import { Platform, Pressable } from 'react-native';
import { act, fireEvent, fireEventAsync, render, waitFor } from '@testing-library/react-native';
import ProfileScreen from '../ProfileScreen';
import MyProfileScreen from '../MyProfileScreen';
import SettingsScreen from '../SettingsScreen';
import ChangePasswordScreen from '../ChangePasswordScreen';
import { useAuth } from '../../../context/AuthContext';
import { useAppTheme } from '../../../context/ThemeContext';
import { createAppTheme } from '../../../styles/theme';
import { userAPI } from '../../../config/api';
import useProfile from '../../../features/profile/useProfile';
import biometricService from '../../../services/biometricService';

jest.mock('../../../config/api', () => ({ userAPI: { updateProfile: jest.fn(), uploadPhoto: jest.fn(), updatePreferences: jest.fn(), changePassword: jest.fn() } }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../context/NotificationContext', () => ({ useNotifications: () => ({ unreadCount: 0 }) }));
jest.mock('../../../context/ThemeContext', () => ({ useAppTheme: jest.fn() }));
jest.mock('../../../features/profile/useProfile', () => jest.fn());
jest.mock('../../../services/biometricService', () => ({ __esModule: true, default: { checkAvailability: jest.fn(), authenticate: jest.fn(), enableBiometric: jest.fn(), disableBiometric: jest.fn() } }));
jest.mock('../../../features/profile/PhotoPicker', () => { const React = require('react'); const { View } = require('react-native'); return props => React.createElement(View, { ...props, testID: 'photo-picker' }); });
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));

const profile = { uid: 'demo-user', firstName: 'Demo', lastName: 'User', email: 'demo@example.test', phoneNumber: '', emailVerified: false, phoneVerified: false, preferences: { theme: 'system', notifications: true, biometrics: false } };
const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const refresh = jest.fn();
const replace = jest.fn();
const verify = jest.fn();
const logout = jest.fn();
const setMode = jest.fn();
const passphrase = 'a new synthetic passphrase';
const originalPlatform = Platform.OS;
const fill = (view, label, value) => fireEvent.changeText(view.getByLabelText(label), value);
const press = (view, label) => fireEvent.press(view.getByRole('button', { name: label }));

beforeEach(() => {
  jest.clearAllMocks();
  useProfile.mockReturnValue({ profile, loading: false, error: '', refresh, replace });
  useAuth.mockReturnValue({ user: profile, checkAuthStatus: verify, logout });
  useAppTheme.mockReturnValue({ ...createAppTheme(false), setMode, reduceMotion: true });
  verify.mockResolvedValue(undefined); logout.mockResolvedValue(undefined); setMode.mockResolvedValue(undefined);
  biometricService.checkAvailability.mockResolvedValue({ canUseBiometrics: false });
  biometricService.authenticate.mockResolvedValue({ success: true });
  biometricService.enableBiometric.mockResolvedValue(true); biometricService.disableBiometric.mockResolvedValue(true);
  userAPI.updateProfile.mockResolvedValue({ data: { user: { ...profile, firstName: 'Updated' } } });
  userAPI.uploadPhoto.mockResolvedValue({ data: { photoUrl: 'data:image/png;base64,iVBORw0KGgo=' } });
  userAPI.updatePreferences.mockResolvedValue({ data: { preferences: { ...profile.preferences, theme: 'dark' } } });
  userAPI.changePassword.mockResolvedValue({ data: { sessionsRevoked: true } });
});
afterEach(() => { Platform.OS = originalPlatform; });

test('web appearance radios expose selection and support Space, arrow wrapping and one keyboard tab stop', async () => {
  Platform.OS = 'web';
  // Actual DOM focus transfer is covered by browser-features-smoke; the native
  // renderer cannot provide a web Pressable DOM ref.
  const view = render(<SettingsScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText(/Biometric confirmation is unavailable/)).toBeTruthy());
  const radio = label => view.UNSAFE_getAllByType(Pressable).find(element => element.props.accessibilityRole === 'radio' && element.props.accessibilityLabel === label);
  const key = (label, value) => {
    const event = { key: value, preventDefault: jest.fn(), stopPropagation: jest.fn() };
    act(() => radio(label).props.onKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  };
  expect(radio('System').props['aria-checked']).toBe(true);
  expect(radio('Dark').props['aria-checked']).toBe(false);
  key('System', 'ArrowRight');
  expect(radio('Light').props['aria-checked']).toBe(true);
  expect(['System', 'Light', 'Dark'].map(label => radio(label).props.tabIndex)).toEqual([-1, 0, -1]);
  key('Light', 'ArrowDown');
  key('Dark', 'ArrowRight');
  expect(radio('System').props['aria-checked']).toBe(true);
  key('System', 'ArrowLeft');
  expect(radio('Dark').props['aria-checked']).toBe(true);
  key('Light', ' ');
  expect(radio('Light').props['aria-checked']).toBe(true);
  expect(userAPI.updatePreferences).not.toHaveBeenCalled();
});

test('web appearance radio keyboard input cannot change selection while saving', async () => {
  Platform.OS = 'web';
  let complete;
  userAPI.updatePreferences.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
  const view = render(<SettingsScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText(/Biometric confirmation is unavailable/)).toBeTruthy());
  press(view, 'Save preferences');
  const radios = view.UNSAFE_getAllByType(Pressable).filter(element => element.props.accessibilityRole === 'radio');
  expect(radios.every(element => element.props['aria-disabled'] === true && element.props.tabIndex === -1)).toBe(true);
  act(() => radios[0].props.onKeyDown({ key: 'ArrowRight', preventDefault: jest.fn(), stopPropagation: jest.fn() }));
  expect(view.getByRole('radio', { name: 'System' }).props.accessibilityState.checked).toBe(true);
  await act(async () => complete({ data: { preferences: profile.preferences } }));
});

test('name updates send only editable names and refresh verified account data without restarting navigation', async () => {
  const view = render(<MyProfileScreen navigation={navigation} />);
  expect(view.getByLabelText('Email address').props.editable).toBe(false);
  expect(view.getByLabelText('Phone number').props.editable).toBe(false);
  expect(view.getByText('Email not verified')).toBeTruthy();
  expect(view.getByText('Phone not verified')).toBeTruthy();
  fill(view, 'First name', ' Updated ');
  fill(view, 'Last name', ' User ');
  press(view, 'Save name');
  await waitFor(() => expect(view.getByText('Your name has been saved.')).toBeTruthy());
  expect(userAPI.updateProfile).toHaveBeenCalledWith({ firstName: 'Updated', lastName: 'User' });
  expect(verify).toHaveBeenCalledWith({ background: true });
  expect(replace).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Updated' }));
});

test('invalid names are blocked and failed writes retain the entered name for retry', async () => {
  const view = render(<MyProfileScreen navigation={navigation} />);
  fill(view, 'First name', '  ');
  press(view, 'Save name');
  expect(view.getByText('Enter your first name.')).toBeTruthy();
  expect(userAPI.updateProfile).not.toHaveBeenCalled();
  fill(view, 'First name', 'Updated');
  userAPI.updateProfile.mockRejectedValueOnce({ response: { data: { error: 'Reconnect and retry' } } });
  press(view, 'Save name');
  await waitFor(() => expect(view.getByText('Reconnect and retry')).toBeTruthy());
  expect(view.getByLabelText('First name').props.value).toBe('Updated');
  expect(view.queryByText('Your name has been saved.')).toBeNull();
});

test('photo selection is a preview until explicit upload, and the canonical result is refreshed', async () => {
  const view = render(<MyProfileScreen navigation={navigation} />);
  const photo = 'data:image/png;base64,iVBORw0KGgo=';
  await act(async () => view.getByTestId('photo-picker').props.onSelect(async () => photo));
  expect(userAPI.uploadPhoto).not.toHaveBeenCalled();
  expect(view.getByText(/Preview only/)).toBeTruthy();
  press(view, 'Save photo');
  await waitFor(() => expect(userAPI.uploadPhoto).toHaveBeenCalledWith({ photo }));
  await waitFor(() => expect(view.getByText('Your profile photo has been saved.')).toBeTruthy());
  expect(verify).toHaveBeenCalledWith({ background: true });
});

test('photo read failure never uploads and photo upload failure preserves the preview', async () => {
  const view = render(<MyProfileScreen navigation={navigation} />);
  await act(async () => view.getByTestId('photo-picker').props.onSelect(async () => { throw new Error('Choose a photo under 1 MB.'); }));
  expect(view.getByText('Choose a photo under 1 MB.')).toBeTruthy();
  expect(userAPI.uploadPhoto).not.toHaveBeenCalled();
  await act(async () => view.getByTestId('photo-picker').props.onSelect(async () => 'data:image/png;base64,iVBORw0KGgo='));
  userAPI.uploadPhoto.mockRejectedValueOnce(new Error('Connection unavailable'));
  press(view, 'Save photo');
  await waitFor(() => expect(view.getByText('Connection unavailable')).toBeTruthy());
  expect(view.getByRole('button', { name: 'Save photo' })).toBeEnabled();
  expect(view.queryByText('Your profile photo has been saved.')).toBeNull();
});

test('preferences persist to the server before applying appearance and refreshing the session', async () => {
  const view = render(<SettingsScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText(/Biometric confirmation is unavailable/)).toBeTruthy());
  fireEvent.press(view.getByRole('radio', { name: 'Dark' }));
  expect(userAPI.updatePreferences).not.toHaveBeenCalled();
  press(view, 'Save preferences');
  await waitFor(() => expect(view.getByText('Your preferences have been saved.')).toBeTruthy());
  expect(userAPI.updatePreferences).toHaveBeenCalledWith({ theme: 'dark', notifications: true, biometrics: false });
  expect(setMode).toHaveBeenCalledWith('dark');
  expect(verify).toHaveBeenCalledWith({ background: true });
});

test('a failed preference save preserves selections without claiming persistence or applying appearance', async () => {
  userAPI.updatePreferences.mockRejectedValueOnce(new Error('offline'));
  const view = render(<SettingsScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText(/Biometric confirmation is unavailable/)).toBeTruthy());
  fireEvent.press(view.getByRole('radio', { name: 'Dark' }));
  press(view, 'Save preferences');
  await waitFor(() => expect(view.getByText(/We could not save your preferences/)).toBeTruthy());
  expect(view.getByRole('radio', { name: 'Dark' }).props.accessibilityState.checked).toBe(true);
  expect(setMode).not.toHaveBeenCalled();
});

test('biometric controls stay disabled without local capability and do not prompt on screen load', async () => {
  const view = render(<SettingsScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText(/Biometric confirmation is unavailable/)).toBeTruthy());
  expect(view.getByLabelText('Optional device confirmation')).toBeDisabled();
  expect(biometricService.authenticate).not.toHaveBeenCalled();
  expect(view.getByText(/never replaces the server verification code/)).toBeTruthy();
});

test('enabling biometric preference requires a successful local prompt and still needs an explicit save', async () => {
  biometricService.checkAvailability.mockResolvedValueOnce({ canUseBiometrics: true });
  biometricService.authenticate.mockResolvedValueOnce({ success: false });
  const view = render(<SettingsScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByLabelText('Optional device confirmation')).toBeEnabled());
  await fireEventAsync(view.getByLabelText('Optional device confirmation'), 'valueChange', true);
  expect(view.getByText(/Device confirmation was not completed/)).toBeTruthy();
  expect(view.getByLabelText('Optional device confirmation').props.value).toBe(false);
  await fireEventAsync(view.getByLabelText('Optional device confirmation'), 'valueChange', true);
  expect(view.getByLabelText('Optional device confirmation').props.value).toBe(true);
  expect(userAPI.updatePreferences).not.toHaveBeenCalled();
});

test('password change blocks invalid input and keeps a failed current-password proof in the form', async () => {
  const view = render(<ChangePasswordScreen navigation={navigation} />);
  press(view, 'Update password');
  expect(view.getByText('Enter your current password.')).toBeTruthy();
  expect(userAPI.changePassword).not.toHaveBeenCalled();
  fill(view, 'Current password', 'wrong old password'); fill(view, 'New password', passphrase); fill(view, 'Confirm new password', passphrase);
  userAPI.changePassword.mockRejectedValueOnce({ response: { data: { error: 'The current password is incorrect' } } });
  press(view, 'Update password');
  await waitFor(() => expect(view.getByText('The current password is incorrect')).toBeTruthy());
  expect(logout).not.toHaveBeenCalled();
  expect(view.getByRole('button', { name: 'Update password' })).toBeEnabled();
});

test('successful password change clears sensitive fields and completes logout', async () => {
  const view = render(<ChangePasswordScreen navigation={navigation} />);
  fill(view, 'Current password', 'old synthetic password'); fill(view, 'New password', passphrase); fill(view, 'Confirm new password', passphrase);
  press(view, 'Update password');
  await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  expect(userAPI.changePassword).toHaveBeenCalledWith({ currentPassword: 'old synthetic password', newPassword: passphrase });
  expect(view.getByLabelText('Current password').props.value).toBe('');
  expect(view.getByLabelText('New password').props.value).toBe('');
});

test('sign-out requires confirmation and a failed revocation is never reported as fully completed', async () => {
  logout.mockRejectedValueOnce(new Error('offline'));
  const view = render(<ProfileScreen navigation={navigation} />);
  press(view, 'Sign out');
  expect(logout).not.toHaveBeenCalled();
  press(view, 'Sign out now');
  await waitFor(() => expect(view.getByText('Signed out on this screen. Reconnect to finish ending your server session.')).toBeTruthy());
  expect(logout).toHaveBeenCalledTimes(1);
});

test('profile loading failure offers retry instead of fabricating empty account data', () => {
  useProfile.mockReturnValue({ profile: null, loading: false, error: 'Profile unavailable', refresh });
  const view = render(<MyProfileScreen navigation={navigation} />);
  expect(view.queryByLabelText('First name')).toBeNull();
  press(view, 'Try again');
  expect(refresh).toHaveBeenCalledTimes(1);
});
