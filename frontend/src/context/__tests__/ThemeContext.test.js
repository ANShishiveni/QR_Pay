import React from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider, useAppTheme } from '../ThemeContext';
import { darkColors, lightColors } from '../../styles/theme';

jest.mock('../../utils/asyncStorage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));
let current;
function Probe() { current = useAppTheme(); return <Text>{current.appearanceReady ? current.mode : 'loading appearance'}</Text>; }
let remove;
beforeEach(() => {
  remove = jest.fn();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove });
});
afterEach(() => jest.restoreAllMocks());

test('saved appearance loads before ready and changes persist only as a non-sensitive preference', async () => {
  const storage = { getItem: jest.fn().mockResolvedValue('dark'), setItem: jest.fn().mockResolvedValue() };
  const view = render(<ThemeProvider storage={storage}><Probe /></ThemeProvider>);
  expect(view.getByText('loading appearance')).toBeTruthy();
  await waitFor(() => expect(view.getByText('dark')).toBeTruthy());
  expect(current.colors).toEqual(darkColors);
  expect(current.reduceMotion).toBe(true);
  await act(async () => current.setMode('light'));
  expect(storage.setItem).toHaveBeenCalledWith('appearance', 'light');
  expect(current.colors).toEqual(lightColors);
  view.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});

test('verified account preference wins over a slower device preference read', async () => {
  let completeRead;
  const storage = { getItem: jest.fn(() => new Promise(resolve => { completeRead = resolve; })), setItem: jest.fn() };
  const view = render(<ThemeProvider storage={storage} preference="dark"><Probe /></ThemeProvider>);
  await act(async () => completeRead('light'));
  expect(view.getByText('dark')).toBeTruthy();
  expect(current.isDark).toBe(true);
});

test('unavailable preference storage still allows the app to start using system appearance', async () => {
  const storage = { getItem: jest.fn().mockRejectedValue(new Error('Unavailable')), setItem: jest.fn() };
  const view = render(<ThemeProvider storage={storage}><Probe /></ThemeProvider>);
  await waitFor(() => expect(view.getByText('system')).toBeTruthy());
  await act(async () => expect(current.setMode('unsupported')).rejects.toThrow('Choose light, dark, or system'));
  expect(storage.setItem).not.toHaveBeenCalled();
});

const luminance = hex => {
  const rgb = hex.match(/[a-f\d]{2}/gi).map(part => parseInt(part, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const contrast = (first, second) => {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

test.each([['light', lightColors], ['dark', darkColors]])('%s semantic text and control tokens meet minimum contrast', (_, palette) => {
  for (const [foreground, background] of [
    ['text', 'surface'], ['textSecondary', 'surface'], ['textSecondary', 'background'], ['onPrimary', 'primary'],
    ['primary', 'primarySoft'], ['onError', 'error'], ['error', 'errorSoft'], ['warning', 'warningSoft'],
    ['info', 'infoSoft'], ['heroText', 'hero'], ['heroMuted', 'hero'],
  ]) expect(contrast(palette[foreground], palette[background])).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.controlBorder, palette.surface)).toBeGreaterThanOrEqual(3);
});
