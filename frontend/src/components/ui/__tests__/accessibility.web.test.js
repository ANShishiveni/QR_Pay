import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.node';
import { AppButton, AppHeader, AppText, AppTextField, LoadingSkeleton, MaskedCard } from '..';
import { accessibilityStateProps } from '../accessibility';
import { Pressable, Text } from 'react-native';

// Exercise the actual installed DOM renderer. Native component mocks cannot
// detect RN Web dropping accessibilityState or accessibilityHint.
jest.mock('react-native', () => jest.requireActual('react-native-web'));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native-web').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../../context/ThemeContext', () => ({ useAppTheme: () => ({
  colors: { text: '#142230', primary: '#06796B', surface: '#FFFFFF' }, typography: {}, reduceMotion: true,
}) }));

test('DOM buttons retain expanded and selected states while pending actions are disabled and busy', () => {
  const html = renderToStaticMarkup(<AppButton title="Choose filter" loading accessibilityState={{ expanded: true, selected: true }} onPress={() => {}} />);
  expect(html).toContain('aria-expanded="true"');
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('aria-disabled="true"');
  expect(html).toMatch(/<button[^>]* disabled=""/);
  expect(html).not.toContain('aria-selected=');
});

test('an unselected test instrument remains an announced toggle button', () => {
  const html = renderToStaticMarkup(<MaskedCard card={{ brand: 'Visa', last4: '4242' }} selected={false} onPress={() => {}} />);
  expect(html).toContain('aria-pressed="false"');
  expect(html).toContain('aria-label="Visa test instrument ending 4242"');
});

test('tab selection uses aria-selected and loading indicators expose busy state', () => {
  const html = renderToStaticMarkup(<>
    <Pressable accessibilityRole="tab" {...accessibilityStateProps({ selected: true }, 'tab')}><Text>Home</Text></Pressable>
    <LoadingSkeleton label="Loading activity" />
  </>);
  expect(html).toContain('aria-selected="true"');
  expect(html).not.toContain('aria-pressed=');
  expect(html).toMatch(/<div[^>]*aria-busy="true"[^>]*aria-label="Loading activity"[^>]*role="progressbar"/);
});

test('input errors and hints have real DOM references without dropping an additional description', () => {
  const html = renderToStaticMarkup(<>
    <AppText nativeID="additional-help">Use synthetic details.</AppText>
    <AppTextField nativeID="reference" label="Reference" hint="Maximum 80 characters." aria-describedby="additional-help" />
    <AppTextField nativeID="amount" label="Amount" error="Enter a positive amount." />
  </>);
  expect(html).toMatch(/<input[^>]*aria-describedby="additional-help reference-description"[^>]*aria-invalid="false"/);
  expect(html).toContain('id="reference-description"');
  expect(html).toMatch(/<input[^>]*aria-describedby="amount-description"[^>]*aria-invalid="true"/);
  expect(html).toContain('id="amount-description"');
  expect(html).toContain('Enter a positive amount.');
});

test('screen, section and explicitly nested headings render a meaningful DOM hierarchy', () => {
  const html = renderToStaticMarkup(<>
    <AppHeader title="Profile" />
    <AppText variant="h3" accessibilityRole="header">Account security</AppText>
    <AppText variant="h3" accessibilityRole="header" headingLevel={3}>Device confirmation</AppText>
  </>);
  expect(html).toMatch(/<h1[^>]*>Profile<\/h1>/);
  expect(html).toMatch(/<h2[^>]*>Account security<\/h2>/);
  expect(html).toMatch(/<h3[^>]*>Device confirmation<\/h3>/);
});
