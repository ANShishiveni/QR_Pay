import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import PhotoPicker from '../PhotoPicker';
import { readProfilePhotoAsset } from '../photoReader';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(), requestMediaLibraryPermissionsAsync: jest.fn() }));
jest.mock('../photoReader', () => ({ readProfilePhotoAsset: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

beforeEach(() => jest.clearAllMocks());

test('photo selection is deferred until user intent and lets the parent control loading/upload', async () => {
  let loader;
  const onSelect = jest.fn(value => { loader = value; });
  const view = render(<PhotoPicker onSelect={onSelect} />);
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole('button', { name: 'Change photo' }));
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  const selected = { uri: 'file:///cache/synthetic.png' };
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [selected] });
  readProfilePhotoAsset.mockResolvedValue('data:image/png;base64,synthetic');
  await act(async () => expect(loader()).resolves.toBe('data:image/png;base64,synthetic'));
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ base64: false, exif: false, allowsMultipleSelection: false }));
  expect(readProfilePhotoAsset).toHaveBeenCalledWith(selected);
  expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
});

test('cancelling a picker returns null and busy controls cannot open another picker', async () => {
  let loader;
  const onSelect = jest.fn(value => { loader = value; });
  const view = render(<PhotoPicker onSelect={onSelect} />);
  fireEvent.press(view.getByRole('button', { name: 'Change photo' }));
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
  await expect(loader()).resolves.toBeNull();
  expect(readProfilePhotoAsset).not.toHaveBeenCalled();
  view.rerender(<PhotoPicker onSelect={onSelect} disabled />);
  fireEvent.press(view.getByRole('button', { name: 'Change photo' }));
  expect(onSelect).toHaveBeenCalledTimes(1);
});
