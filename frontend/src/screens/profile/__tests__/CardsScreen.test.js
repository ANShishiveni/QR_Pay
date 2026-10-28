import React from 'react';
import { AppState, TextInput } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import CardsScreen from '../CardsScreen';
import { checkedCards, checkedTestInstruments, cardAvailability } from '../cardModel';
import { paymentAPI } from '../../../config/api';
import { useAuth } from '../../../context/AuthContext';

jest.mock('../../../config/api', () => ({ paymentAPI: { getCards: jest.fn(), getTestInstruments: jest.fn(), addCard: jest.fn(), removeCard: jest.fn(), setDefaultCard: jest.fn() } }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const instruments = [
  { id: 'demo-visa', brand: 'Visa', last4: '4242', bankLabel: 'Demo issuer A' },
  { id: 'demo-mastercard', brand: 'Mastercard', last4: '4444', bankLabel: 'Demo issuer B' },
];
const card = (index = 0, changes = {}) => ({ ...instruments[index], id: `card-${index}`, testCardId: instruments[index].id,
  ownerUid: 'user-1', isDefault: index === 0, expMonth: 12, expYear: new Date().getUTCFullYear() + 3, simulated: true, ...changes });
let cards, navigation;
const press = (view, name) => fireEvent.press(view.getByRole('button', { name }));
const screen = () => render(<CardsScreen navigation={navigation} />);
const openChoices = async view => {
  await waitFor(() => expect(view.getByRole('button', { name: 'Add a test card' })).toBeEnabled());
  press(view, 'Add a test card');
};
const selectVisa = async view => {
  await openChoices(view);
  press(view, 'Visa test instrument ending 4242');
  press(view, 'Add selected test card');
};

beforeEach(() => {
  jest.clearAllMocks();
  cards = [];
  navigation = { navigate: jest.fn(), goBack: jest.fn(), isFocused: () => true, addListener: jest.fn(() => jest.fn()) };
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  useAuth.mockReturnValue({ user: { uid: 'user-1' } });
  paymentAPI.getCards.mockImplementation(async () => ({ data: { cards: [...cards], count: cards.length, simulated: true } }));
  paymentAPI.getTestInstruments.mockResolvedValue({ data: { instruments, simulated: true } });
  paymentAPI.addCard.mockImplementation(async ({ testCardId }) => {
    cards.push(card(testCardId === 'demo-visa' ? 0 : 1, { isDefault: cards.length === 0 }));
    return { data: { card: cards[cards.length - 1], simulated: true } };
  });
  paymentAPI.setDefaultCard.mockImplementation(async id => { cards = cards.map(item => ({ ...item, isDefault: item.id === id })); return { data: {} }; });
  paymentAPI.removeCard.mockImplementation(async id => {
    cards = cards.filter(item => item.id !== id).map((item, index) => ({ ...item, isDefault: index === 0 })); return { data: {} };
  });
});

test('empty card manager offers catalog choices and never collects raw card data', async () => {
  const view = screen();
  expect(view.getByLabelText('Loading your test cards')).toBeTruthy();
  await openChoices(view);
  expect(view.getByText('No test cards yet')).toBeTruthy();
  expect(view.getAllByRole('button').map(item => item.props.accessibilityLabel)).toContain('Visa test instrument ending 4242');
  expect(view.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  expect(view.getByRole('button', { name: 'Add selected test card' })).toBeDisabled();
});

test('adding requires selection and confirmation and sends only catalog ID', async () => {
  const view = screen(); await selectVisa(view);
  expect(paymentAPI.addCard).not.toHaveBeenCalled();
  press(view, 'Add test card');
  await waitFor(() => expect(view.getByText('Test card added.')).toBeTruthy());
  expect(paymentAPI.addCard).toHaveBeenCalledWith({ testCardId: 'demo-visa' });
  expect(view.getByText('Default')).toBeTruthy();
  expect(view.getByTestId('linked-card-card-0')).toBeTruthy();
  expect(paymentAPI.getCards).toHaveBeenCalledTimes(2);
  await openChoices(view);
  expect(view.queryByRole('button', { name: 'Visa test instrument ending 4242' })).toBeNull();
  expect(view.getByRole('button', { name: 'Mastercard test instrument ending 4444' })).toBeTruthy();
});

test('rapid confirmation taps submit one add operation', async () => {
  let resolve;
  paymentAPI.addCard.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const view = screen(); await selectVisa(view);
  press(view, 'Add test card'); press(view, 'Add test card');
  expect(paymentAPI.addCard).toHaveBeenCalledTimes(1);
  await act(async () => { cards = [card()]; resolve({ data: {} }); });
  expect(view.getByText('Test card added.')).toBeTruthy();
});

test('a lost add response reconciles the linked card without repeating the mutation', async () => {
  paymentAPI.addCard.mockImplementationOnce(async () => { cards = [card()]; throw new Error('Connection ended'); });
  const view = screen(); await selectVisa(view); press(view, 'Add test card');
  await waitFor(() => expect(view.getByText('Test card added.')).toBeTruthy());
  expect(paymentAPI.addCard).toHaveBeenCalledTimes(1);
  expect(view.getAllByText('Default')).toHaveLength(1);
});

test('unknown add result locks further mutations and retains selection until a server check', async () => {
  const view = screen(); await selectVisa(view);
  paymentAPI.addCard.mockRejectedValueOnce(new Error('Connection ended'));
  paymentAPI.getCards.mockRejectedValueOnce(new Error('Offline'));
  press(view, 'Add test card');
  await waitFor(() => expect(view.getByText('We couldn’t confirm the change. Check your cards before making another change.')).toBeTruthy());
  expect(view.getByRole('button', { name: 'Add selected test card' })).toBeDisabled();
  cards = [card()]; press(view, 'Check my cards');
  await waitFor(() => expect(view.getByText('Test card added.')).toBeTruthy());
  expect(paymentAPI.addCard).toHaveBeenCalledTimes(1);
});

test('a rejected add keeps the selected test instrument ready for an explicit retry', async () => {
  paymentAPI.addCard.mockRejectedValueOnce({ response: { status: 400 } });
  const view = screen(); await selectVisa(view); press(view, 'Add test card');
  await waitFor(() => expect(view.getByText('That change is not present in your latest card list. Review the cards below before trying again.')).toBeTruthy());
  expect(view.getByRole('button', { name: 'Add selected test card' })).toBeEnabled();
  expect(view.queryByText('Test card added.')).toBeNull();
  expect(paymentAPI.addCard).toHaveBeenCalledTimes(1);
});

test('default change uses the refreshed server flags, including a lost response', async () => {
  cards = [card(), card(1)];
  paymentAPI.setDefaultCard.mockImplementationOnce(async id => { cards = cards.map(item => ({ ...item, isDefault: item.id === id })); throw new Error('Lost response'); });
  const view = screen();
  await waitFor(() => expect(view.getByRole('button', { name: 'Make Mastercard ending 4444 default' })).toBeTruthy());
  press(view, 'Make Mastercard ending 4444 default');
  await waitFor(() => expect(view.getByText('Default test card updated.')).toBeTruthy());
  expect(view.getAllByText('Default')).toHaveLength(1);
  expect(view.queryByRole('button', { name: 'Make Mastercard ending 4444 default' })).toBeNull();
  expect(view.getByRole('button', { name: 'Make Visa ending 4242 default' })).toBeEnabled();
  expect(paymentAPI.setDefaultCard).toHaveBeenCalledTimes(1);
});

test('removing the default requires confirmation and shows the server-selected remaining default', async () => {
  cards = [card(), card(1)];
  const view = screen();
  await waitFor(() => expect(view.getByRole('button', { name: 'Remove Visa ending 4242' })).toBeTruthy());
  press(view, 'Remove Visa ending 4242'); expect(paymentAPI.removeCard).not.toHaveBeenCalled();
  press(view, 'Cancel'); expect(paymentAPI.removeCard).not.toHaveBeenCalled();
  press(view, 'Remove Visa ending 4242'); press(view, 'Remove test card');
  await waitFor(() => expect(view.getByText('Test card removed.')).toBeTruthy());
  expect(view.queryByTestId('linked-card-card-0')).toBeNull();
  expect(view.getByTestId('linked-card-card-1')).toBeTruthy();
  expect(view.getAllByText('Default')).toHaveLength(1);
});

test('404 removal is successful only when the server list confirms absence', async () => {
  cards = [card()];
  paymentAPI.removeCard.mockImplementationOnce(async () => { cards = []; throw { response: { status: 404 } }; });
  const view = screen();
  await waitFor(() => expect(view.getByRole('button', { name: 'Remove Visa ending 4242' })).toBeTruthy());
  press(view, 'Remove Visa ending 4242'); press(view, 'Remove test card');
  await waitFor(() => expect(view.getByText('Test card removed.')).toBeTruthy());
  expect(view.getByText('No test cards yet')).toBeTruthy();
});

test('failed removal does not optimistically delete a card', async () => {
  cards = [card()]; paymentAPI.removeCard.mockRejectedValueOnce(new Error('No response'));
  const view = screen();
  await waitFor(() => expect(view.getByRole('button', { name: 'Remove Visa ending 4242' })).toBeTruthy());
  press(view, 'Remove Visa ending 4242'); press(view, 'Remove test card');
  await waitFor(() => expect(view.getByText('That change is not present in your latest card list. Review the cards below before trying again.')).toBeTruthy());
  expect(view.getByTestId('linked-card-card-0')).toBeTruthy();
  expect(view.queryByText('Test card removed.')).toBeNull();
});

test('legacy and expired records are masked and removable but not offered as eligible defaults', async () => {
  cards = [card(0, { testCardId: null, ownerUid: null }), card(1, { expYear: 2020 })];
  const view = screen();
  await waitFor(() => expect(view.getByText('Replace before paying')).toBeTruthy());
  expect(view.getByText('Expired · remove and add again')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Remove Visa ending 4242' })).toBeEnabled();
  expect(view.queryByRole('button', { name: 'Make Mastercard ending 4444 default' })).toBeNull();
});

test('legacy inconsistent defaults are disclosed and can be repaired by a server mutation', async () => {
  cards = [card(), card(1, { isDefault: true })];
  const view = screen();
  await waitFor(() => expect(view.getByText('Choose one default card')).toBeTruthy());
  press(view, 'Make Visa ending 4242 default');
  await waitFor(() => expect(view.getByText('Default test card updated.')).toBeTruthy());
  expect(view.queryByText('Choose one default card')).toBeNull();
  expect(view.getAllByText('Default')).toHaveLength(1);
});

test('network failures are distinct from an empty card list and support a safe read retry', async () => {
  paymentAPI.getCards.mockRejectedValueOnce(new Error('Offline'));
  const view = screen();
  await waitFor(() => expect(view.getByText('Cards unavailable')).toBeTruthy());
  expect(view.queryByText('No test cards yet')).toBeNull();
  expect(view.getByRole('button', { name: 'Add a test card' })).toBeDisabled();
  press(view, 'Refresh test cards');
  await waitFor(() => expect(view.getByText('No test cards yet')).toBeTruthy());
});

test('an unapproved catalog never creates a card input or allows an add', async () => {
  paymentAPI.getTestInstruments.mockResolvedValueOnce({ data: { simulated: true, instruments: [{ id: 'live-card', brand: 'Visa', last4: '1234' }] } });
  const view = screen();
  await waitFor(() => expect(view.getByText('Test-card catalog unavailable')).toBeTruthy());
  expect(view.queryByRole('button', { name: 'Add a test card' })).toBeNull();
  expect(view.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
});

test('card DTO mapping strips secrets, rejects another owner and does not invent defaults', () => {
  const result = checkedCards({ simulated: true, cards: [card(0, { isDefault: false, cardNumber: 'secret-pan', cvc: 'secret-cvc', token: 'private' })] }, 'user-1');
  expect(result.defaultCount).toBe(0);
  expect(JSON.stringify(result)).not.toMatch(/secret|private/);
  expect(() => checkedCards({ simulated: true, cards: [card(0, { ownerUid: 'other' })] }, 'user-1')).toThrow();
});

test('eligibility requires a matching predefined instrument and valid expiry', () => {
  const catalog = checkedTestInstruments({ instruments, simulated: true });
  expect(cardAvailability(card(0), catalog, 'user-1')).toBe('ready');
  expect(cardAvailability(card(0, { last4: '9999' }), catalog, 'user-1')).toBe('legacy');
  expect(cardAvailability(card(0, { expMonth: 13 }), catalog, 'user-1')).toBe('expiry-unavailable');
  expect(cardAvailability(card(0, { expYear: 2020 }), catalog, 'user-1')).toBe('expired');
});
