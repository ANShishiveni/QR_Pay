import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';
import RegisterScreen from '../RegisterScreen';
import ForgotPasswordScreen from '../ForgotPasswordScreen';
import ResetPasswordScreen from '../ResetPasswordScreen';
import { authAPI } from '../../../config/api';
import { useAuth } from '../../../context/AuthContext';

jest.mock('../../../config/api', () => ({ authAPI: {
  login: jest.fn(), register: jest.fn(), getCapabilities: jest.fn(), forgotPassword: jest.fn(), resetPassword: jest.fn(),
} }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const login = jest.fn();
const checkAuthStatus = jest.fn();
const passphrase = 'a synthetic passphrase';
const resetCode = 'a'.repeat(64);
const fill = (view, label, value) => fireEvent.changeText(view.getByLabelText(label), value);
const press = (view, name) => fireEvent.press(view.getByRole('button', { name }));
const enterRegistration = view => {
  fill(view, 'First name', ' Demo ');
  fill(view, 'Last name', ' User ');
  fill(view, 'Email address', ' DEMO@EXAMPLE.COM ');
  fill(view, 'Password', passphrase);
  fill(view, 'Confirm password', passphrase);
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ login, checkAuthStatus, authError: null });
  login.mockResolvedValue(undefined);
  authAPI.login.mockResolvedValue({ data: {} });
  authAPI.register.mockResolvedValue({ data: { token: 'synthetic-session' } });
  authAPI.getCapabilities.mockResolvedValue({ data: { passwordRecovery: true } });
  authAPI.forgotPassword.mockResolvedValue({ data: {} });
  authAPI.resetPassword.mockResolvedValue({ data: {} });
});

test('login blocks invalid inputs and exposes an accessible password visibility control', () => {
  const view = render(<LoginScreen navigation={navigation} />);
  press(view, 'Sign in');
  expect(view.getByText('Enter a valid email address.')).toBeTruthy();
  expect(view.getByText('Enter your password.')).toBeTruthy();
  expect(authAPI.login).not.toHaveBeenCalled();
  expect(view.getByLabelText('Password').props.secureTextEntry).toBe(true);
  press(view, 'Show password');
  expect(view.getByLabelText('Password').props.secureTextEntry).toBe(false);
  press(view, 'Hide password');
  expect(view.getByLabelText('Password').props.secureTextEntry).toBe(true);
});

test('login normalizes email and verifies a browser cookie without inventing a token', async () => {
  const view = render(<LoginScreen navigation={navigation} />);
  fill(view, 'Email address', ' DEMO@EXAMPLE.COM ');
  fill(view, 'Password', passphrase);
  press(view, 'Sign in');
  await waitFor(() => expect(login).toHaveBeenCalledWith(undefined));
  expect(authAPI.login).toHaveBeenCalledWith({ email: 'demo@example.com', password: passphrase });
  await waitFor(() => expect(view.getByLabelText('Password').props.value).toBe(''));
});

test('login prevents overlapping requests and preserves input after server rejection', async () => {
  let rejectRequest;
  authAPI.login.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectRequest = reject; }));
  const view = render(<LoginScreen navigation={navigation} />);
  fill(view, 'Email address', 'demo@example.com');
  fill(view, 'Password', passphrase);
  press(view, 'Sign in');
  press(view, 'Sign in');
  expect(authAPI.login).toHaveBeenCalledTimes(1);
  expect(view.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  await act(async () => rejectRequest({ response: { data: { error: 'Email or password is incorrect' } } }));
  expect(view.getByText('Email or password is incorrect')).toBeTruthy();
  expect(view.getByLabelText('Email address').props.value).toBe('demo@example.com');
  expect(view.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  expect(login).not.toHaveBeenCalled();
});

test('login provides explicit session-check retry and recovery navigation', () => {
  useAuth.mockReturnValue({ login, checkAuthStatus, authError: 'Your session could not be verified.' });
  const view = render(<LoginScreen navigation={navigation} />);
  expect(view.getByText('Your session could not be verified.')).toBeTruthy();
  press(view, 'Retry session check');
  expect(checkAuthStatus).toHaveBeenCalledTimes(1);
  press(view, 'Forgot password?');
  expect(navigation.navigate).toHaveBeenCalledWith('ForgotPassword');
});

test('registration rejects short and mismatched passwords before sending account data', () => {
  const view = render(<RegisterScreen navigation={navigation} />);
  enterRegistration(view);
  fill(view, 'Password', 'short');
  press(view, 'Create demo account');
  expect(view.getByText('Use at least 12 characters.')).toBeTruthy();
  expect(view.getByText('Passwords must match.')).toBeTruthy();
  expect(authAPI.register).not.toHaveBeenCalled();
});

test('registration trims names, normalizes email and accepts an optional unverified phone', async () => {
  const view = render(<RegisterScreen navigation={navigation} />);
  enterRegistration(view);
  expect(view.getByText('Adding a number does not verify phone ownership.')).toBeTruthy();
  press(view, 'Create demo account');
  await waitFor(() => expect(login).toHaveBeenCalledWith('synthetic-session'));
  expect(authAPI.register).toHaveBeenCalledWith({ firstName: 'Demo', lastName: 'User', email: 'demo@example.com', phoneNumber: '', password: passphrase });
});

test('registration explains when account creation succeeds but session verification fails', async () => {
  login.mockRejectedValueOnce(new Error('offline'));
  const view = render(<RegisterScreen navigation={navigation} />);
  enterRegistration(view);
  press(view, 'Create demo account');
  await waitFor(() => expect(view.getByText('Your account was created. Sign in to finish verifying your session.')).toBeTruthy());
  press(view, 'Sign in');
  expect(navigation.navigate).toHaveBeenCalledWith('Login');
});

test('recovery is unavailable when the server has no delivery method', async () => {
  authAPI.getCapabilities.mockResolvedValueOnce({ data: { passwordRecovery: false } });
  const view = render(<ForgotPasswordScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Account recovery is not available in this environment.')).toBeTruthy());
  expect(view.queryByRole('button', { name: 'Request recovery instructions' })).toBeNull();
  expect(view.queryByRole('button', { name: 'I have recovery instructions' })).toBeNull();
  expect(authAPI.forgotPassword).not.toHaveBeenCalled();
});

test('recovery capability lookup failure can be retried without requesting a reset', async () => {
  authAPI.getCapabilities.mockRejectedValueOnce(new Error('Connection unavailable'));
  const view = render(<ForgotPasswordScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByText('Connection unavailable')).toBeTruthy());
  press(view, 'Retry availability check');
  await waitFor(() => expect(view.getByLabelText('Email address')).toBeTruthy());
  expect(authAPI.getCapabilities).toHaveBeenCalledTimes(2);
  expect(authAPI.forgotPassword).not.toHaveBeenCalled();
});

test('recovery sends normalized email and displays the same non-enumerating response', async () => {
  const view = render(<ForgotPasswordScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByLabelText('Email address')).toBeTruthy());
  fill(view, 'Email address', ' DEMO@EXAMPLE.COM ');
  press(view, 'Request recovery instructions');
  await waitFor(() => expect(view.getByText('If this account can receive recovery instructions, they have been sent.')).toBeTruthy());
  expect(authAPI.forgotPassword).toHaveBeenCalledWith('demo@example.com');
  expect(view.queryByLabelText('Email address')).toBeNull();
  press(view, 'I have recovery instructions');
  expect(navigation.navigate).toHaveBeenCalledWith('ResetPassword');
});

test('password reset requires private proof and matching new passwords', async () => {
  const view = render(<ResetPasswordScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByLabelText('New password')).toBeTruthy());
  fill(view, 'New password', passphrase);
  fill(view, 'Confirm new password', 'a different passphrase');
  press(view, 'Reset password');
  expect(view.getByText('Enter the recovery code from your private instructions.')).toBeTruthy();
  expect(view.getByText('Passwords must match.')).toBeTruthy();
  expect(authAPI.resetPassword).not.toHaveBeenCalled();
});

test('password reset masks proof, submits it once and requires a new sign-in after success', async () => {
  const view = render(<ResetPasswordScreen navigation={navigation} route={{ params: { token: resetCode } }} />);
  await waitFor(() => expect(view.getByLabelText('Recovery code')).toBeTruthy());
  expect(view.getByLabelText('Recovery code').props.secureTextEntry).toBe(true);
  fill(view, 'New password', passphrase);
  fill(view, 'Confirm new password', passphrase);
  press(view, 'Reset password');
  await waitFor(() => expect(view.getByText('Password updated.')).toBeTruthy());
  expect(authAPI.resetPassword).toHaveBeenCalledWith({ token: resetCode, newPassword: passphrase });
  expect(view.queryByLabelText('Recovery code')).toBeNull();
  expect(view.queryByLabelText('New password')).toBeNull();
  expect(login).not.toHaveBeenCalled();
  press(view, 'Return to sign in');
  expect(navigation.navigate).toHaveBeenCalledWith('Login');
});

test('expired recovery proof shows server failure and a path to new instructions', async () => {
  authAPI.resetPassword.mockRejectedValueOnce({ response: { data: { error: 'This reset link is invalid or expired' } } });
  const view = render(<ResetPasswordScreen navigation={navigation} />);
  await waitFor(() => expect(view.getByLabelText('Recovery code')).toBeTruthy());
  fill(view, 'Recovery code', resetCode);
  fill(view, 'New password', passphrase);
  fill(view, 'Confirm new password', passphrase);
  press(view, 'Reset password');
  await waitFor(() => expect(view.getByText('This reset link is invalid or expired')).toBeTruthy());
  expect(view.queryByText('Password updated.')).toBeNull();
  press(view, 'Request new instructions');
  expect(navigation.navigate).toHaveBeenCalledWith('ForgotPassword');
});

test('direct reset navigation remains unavailable without server recovery capability', async () => {
  authAPI.getCapabilities.mockResolvedValueOnce({ data: { passwordRecovery: false } });
  const view = render(<ResetPasswordScreen navigation={navigation} route={{ params: { token: resetCode } }} />);
  await waitFor(() => expect(view.getByText('Account recovery is not available in this environment.')).toBeTruthy());
  expect(view.queryByLabelText('Recovery code')).toBeNull();
  expect(authAPI.resetPassword).not.toHaveBeenCalled();
});
