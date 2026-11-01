import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import OnboardingScreen from '../OnboardingScreen';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

test('onboarding explains the simulation before completing the three-panel introduction', () => {
  const done = jest.fn();
  const view = render(<OnboardingScreen onComplete={done} />);
  expect(view.getByRole('header', { name: 'Payments, made clear.' })).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Continue' }));
  expect(view.getByRole('header', { name: 'Every step, in view.' })).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Continue' }));
  expect(view.getByRole('header', { name: 'A safer space to try.' })).toBeTruthy();
  expect(view.getByText(/No real money moves/)).toBeTruthy();
  expect(view.getByText(/asks only when you open the scanner/)).toBeTruthy();
  expect(done).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole('button', { name: 'Get started' }));
  expect(done).toHaveBeenCalledTimes(1);
});

test('skip is explicit and both controls block repeat actions while completion is saving', () => {
  const done = jest.fn();
  const view = render(<OnboardingScreen onComplete={done} />);
  fireEvent.press(view.getByRole('button', { name: 'Skip' }));
  expect(done).toHaveBeenCalledTimes(1);
  view.rerender(<OnboardingScreen onComplete={done} loading />);
  fireEvent.press(view.getByRole('button', { name: 'Skip' }));
  fireEvent.press(view.getByRole('button', { name: 'Continue' }));
  expect(done).toHaveBeenCalledTimes(1);
});
