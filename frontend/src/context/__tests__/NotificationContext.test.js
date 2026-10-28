import React from 'react';
import { AppState, Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { NotificationProvider, useNotifications } from '../NotificationContext';
import { useAuth } from '../AuthContext';
import { userAPI } from '../../config/api';
import { setNetworkStatus } from '../../services/networkStatus';

jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../config/api', () => ({ userAPI: { getNotifications: jest.fn(), markNotificationRead: jest.fn() } }));

let inbox, events, lifecycle, removeListener;
const event = changes => ({ id: 'request_created_req-1', recipientUid: 'user-1', eventType: 'request_created', requestId: 'req-1',
  createdAt: '2026-10-28T12:00:00.000Z', readAt: null, simulated: true, ...changes });
const response = notifications => ({ data: { notifications } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function Probe() { inbox = useNotifications(); return <Text>{inbox.loading ? 'loading' : `${inbox.items.length} updates`}</Text>; }
const tree = () => <NotificationProvider><Probe /></NotificationProvider>;
const mount = async () => { const view = render(tree()); await waitFor(() => expect(inbox.loading).toBe(false)); return view; };

beforeEach(() => {
  jest.clearAllMocks();
  setNetworkStatus('unknown');
  events = [event()]; removeListener = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((name, callback) => { lifecycle = callback; return { remove: removeListener }; });
  useAuth.mockReturnValue({ user: { uid: 'user-1', preferences: { notifications: true } } });
  userAPI.getNotifications.mockImplementation(async () => response(events));
  userAPI.markNotificationRead.mockImplementation(async id => {
    events = events.map(item => item.id === id ? { ...item, readAt: '2026-10-28T12:01:00.000Z' } : item);
    return { data: { message: 'Notification marked as read' } };
  });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('signed-out users have no inbox or requests, and signing in loads the current account', async () => {
  useAuth.mockReturnValue({ user: null });
  const view = render(tree());
  expect(inbox.items).toEqual([]); expect(inbox.unreadCount).toBe(0); expect(inbox.alertsEnabled).toBe(false);
  await act(async () => inbox.refresh());
  expect(userAPI.getNotifications).not.toHaveBeenCalled();
  useAuth.mockReturnValue({ user: { uid: 'user-1' } }); view.rerender(tree());
  await waitFor(() => expect(inbox.items).toHaveLength(1));
  expect(inbox.unreadCount).toBe(1);
});

test('the provider deduplicates events and suppresses badges without removing a muted inbox', async () => {
  events = [event(), event(), event({ id: 'request_expired_req-1', eventType: 'request_expired', readAt: '2026-10-28T12:01:00.000Z' })];
  const view = await mount();
  expect(inbox.items).toHaveLength(2); expect(inbox.unreadCount).toBe(1);
  useAuth.mockReturnValue({ user: { uid: 'user-1', preferences: { notifications: false } } });
  view.rerender(tree());
  expect(inbox.unreadCount).toBe(0); expect(inbox.inboxUnreadCount).toBe(1); expect(inbox.items).toHaveLength(2);
  expect(inbox.alertsEnabled).toBe(false); expect(userAPI.getNotifications).toHaveBeenCalledTimes(1);
  useAuth.mockReturnValue({ user: { uid: 'user-1', preferences: { notifications: true } } }); view.rerender(tree());
  expect(inbox.unreadCount).toBe(1);
});

test('overlapping refreshes share one read and failures keep the last verified inbox with a safe error', async () => {
  await mount();
  const pending = deferred(); userAPI.getNotifications.mockReturnValueOnce(pending.promise);
  let first, second;
  act(() => { first = inbox.refresh(); second = inbox.refresh(); });
  expect(first).toBe(second);
  await act(async () => { pending.reject(new Error('secret server body')); await first; });
  expect(userAPI.getNotifications).toHaveBeenCalledTimes(2);
  expect(inbox.items).toHaveLength(1); expect(inbox.error).toBe('Your inbox could not be refreshed. Reconnect and try again.');
  expect(inbox.error).not.toContain('secret');
});

test('logout immediately clears items and an old response cannot restore them', async () => {
  const view = await mount();
  const pending = deferred(); userAPI.getNotifications.mockReturnValueOnce(pending.promise);
  let read; act(() => { read = inbox.refresh(); });
  useAuth.mockReturnValue({ user: null }); view.rerender(tree());
  expect(inbox.items).toEqual([]); expect(inbox.unreadCount).toBe(0);
  await act(async () => { pending.resolve(response(events)); await read; });
  expect(inbox.items).toEqual([]); expect(inbox.error).toBe('');
});

test('a late first-account read cannot replace a new account, even after returning to the first UID', async () => {
  const old = deferred(); userAPI.getNotifications.mockReturnValueOnce(old.promise);
  const view = render(tree()); await act(async () => {});
  events = [event({ recipientUid: 'user-2', id: 'request_created_req-2', requestId: 'req-2' })];
  useAuth.mockReturnValue({ user: { uid: 'user-2' } }); view.rerender(tree());
  await waitFor(() => expect(inbox.items[0]?.requestId).toBe('req-2'));
  events = [event({ id: 'request_expired_req-3', requestId: 'req-3', eventType: 'request_expired' })];
  useAuth.mockReturnValue({ user: { uid: 'user-1' } }); view.rerender(tree());
  await waitFor(() => expect(inbox.items[0]?.requestId).toBe('req-3'));
  await act(async () => old.resolve(response([event()])));
  expect(inbox.items.map(item => item.requestId)).toEqual(['req-3']);
});

test('a forced newer refresh invalidates an older list response', async () => {
  await mount();
  const old = deferred(); userAPI.getNotifications.mockReturnValueOnce(old.promise);
  let oldRead; act(() => { oldRead = inbox.refresh(); }); await act(async () => {});
  events = [event({ readAt: '2026-10-28T12:01:00.000Z' })];
  await act(async () => inbox.refresh(true));
  await act(async () => { old.resolve(response([event()])); await oldRead; });
  expect(inbox.unreadCount).toBe(0);
});

test('foreground polling and resume refresh stop in the background and are cleaned up', async () => {
  jest.useFakeTimers();
  const view = render(tree()); await act(async () => {});
  expect(userAPI.getNotifications).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(userAPI.getNotifications).toHaveBeenCalledTimes(2);
  act(() => lifecycle('background'));
  await act(async () => { jest.advanceTimersByTime(90000); });
  expect(userAPI.getNotifications).toHaveBeenCalledTimes(2);
  await act(async () => lifecycle('active'));
  expect(userAPI.getNotifications).toHaveBeenCalledTimes(3);
  await act(async () => lifecycle('active'));
  expect(userAPI.getNotifications).toHaveBeenCalledTimes(3);
  view.unmount(); expect(removeListener).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(60000); setNetworkStatus('unreachable'); setNetworkStatus('reachable'); });
  expect(userAPI.getNotifications).toHaveBeenCalledTimes(3);
});

test('reconnection refreshes only while signed in and foregrounded', async () => {
  await mount();
  await act(async () => { setNetworkStatus('unreachable'); setNetworkStatus('reachable'); });
  expect(userAPI.getNotifications).toHaveBeenCalledTimes(2);
  act(() => lifecycle('background'));
  await act(async () => { setNetworkStatus('unreachable'); setNetworkStatus('reachable'); });
  expect(userAPI.getNotifications).toHaveBeenCalledTimes(2);
  await act(async () => lifecycle('active'));
  expect(userAPI.getNotifications).toHaveBeenCalledTimes(3);
});

test('mark-read taps share one write and do not optimistically erase the unread badge', async () => {
  await mount();
  const write = deferred(); userAPI.markNotificationRead.mockReturnValueOnce(write.promise);
  let first, second;
  act(() => { first = inbox.markRead(events[0].id); second = inbox.markRead(events[0].id); });
  await act(async () => {});
  expect(first).toBe(second); expect(userAPI.markNotificationRead).toHaveBeenCalledTimes(1);
  expect(inbox.unreadCount).toBe(1); expect(inbox.readingIds).toEqual([events[0].id]);
  await act(async () => { events = [event({ readAt: '2026-10-28T12:01:00.000Z' })]; write.resolve({ data: {} }); await first; });
  expect(inbox.unreadCount).toBe(0); expect(inbox.readingIds).toEqual([]); expect(inbox.markError).toBe('');
});

test('a lost mark-read response is reconciled with the server list', async () => {
  await mount();
  userAPI.markNotificationRead.mockImplementationOnce(async () => { events = [event({ readAt: '2026-10-28T12:01:00.000Z' })]; throw new Error('Lost response'); });
  let result; await act(async () => { result = await inbox.markRead(events[0].id); });
  expect(result).toBe(true); expect(inbox.unreadCount).toBe(0); expect(userAPI.markNotificationRead).toHaveBeenCalledTimes(1);
});

test('unconfirmed read markers remain unread and allow an explicit retry', async () => {
  await mount();
  userAPI.markNotificationRead.mockRejectedValueOnce(new Error('Offline'));
  let result; await act(async () => { result = await inbox.markRead(events[0].id); });
  expect(result).toBe(false); expect(inbox.unreadCount).toBe(1); expect(inbox.markError).toContain('couldn’t confirm');
  expect(inbox.readingIds).toEqual([]);
  await act(async () => inbox.markRead(events[0].id));
  expect(inbox.unreadCount).toBe(0); expect(inbox.markError).toBe('');
  expect(userAPI.markNotificationRead).toHaveBeenCalledTimes(2);
});

test('marking different updates serializes reconciliation so neither confirmed marker is lost', async () => {
  events = [event(), event({ id: 'request_expired_req-1', eventType: 'request_expired' })];
  await mount();
  let first, second;
  act(() => { first = inbox.markRead(events[0].id); second = inbox.markRead(events[1].id); });
  await act(async () => { await Promise.all([first, second]); });
  expect(inbox.unreadCount).toBe(0); expect(inbox.markError).toBe('');
  expect(userAPI.markNotificationRead).toHaveBeenCalledTimes(2); expect(userAPI.getNotifications).toHaveBeenCalledTimes(3);
});

test('unread markers and queued writes cannot cross an account change', async () => {
  events = [event(), event({ id: 'request_expired_req-1', eventType: 'request_expired' })];
  const view = await mount();
  const write = deferred(); userAPI.markNotificationRead.mockReturnValueOnce(write.promise);
  let first, second;
  act(() => { first = inbox.markRead(events[0].id); second = inbox.markRead(events[1].id); }); await act(async () => {});
  useAuth.mockReturnValue({ user: null }); view.rerender(tree());
  await act(async () => { write.resolve({ data: {} }); await Promise.all([first, second]); });
  expect(userAPI.markNotificationRead).toHaveBeenCalledTimes(1);
  expect(inbox.items).toEqual([]); expect(inbox.readingIds).toEqual([]); expect(inbox.markError).toBe('');
});

test('unknown IDs and foreign inbox responses are rejected without sending a marker', async () => {
  events = [event({ recipientUid: 'other' })];
  await mount(); expect(inbox.items).toEqual([]); expect(inbox.error).toContain('could not be refreshed');
  let result; await act(async () => { result = await inbox.markRead('unknown'); });
  expect(result).toBe(false); expect(userAPI.markNotificationRead).not.toHaveBeenCalled();
});
