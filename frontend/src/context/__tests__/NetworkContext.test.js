import React from 'react';
import { AppState, Text } from 'react-native';
import { act, cleanup, render } from '@testing-library/react-native';
import { NetworkProvider, useNetwork } from '../NetworkContext';
import apiClient from '../../config/api';
import { setNetworkStatus } from '../../services/networkStatus';

jest.mock('../../config/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
let connection;
let lifecycle;
function Probe() { connection = useNetwork(); return <Text>{connection.status}</Text>; }
beforeEach(() => {
  jest.useFakeTimers(); setNetworkStatus('unknown');
  jest.spyOn(AppState, 'addEventListener').mockImplementation((name, callback) => { lifecycle = callback; return { remove: jest.fn() }; });
  apiClient.get.mockReset();
});
afterEach(() => { cleanup(); jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

test('one shared read probe recovers connection without replaying a mutation', async () => {
  let resolve;
  apiClient.get.mockReturnValue(new Promise(done => { resolve = done; }));
  const view = render(<NetworkProvider><Probe /></NetworkProvider>);
  act(() => setNetworkStatus('unreachable'));
  expect(view.getByText('unreachable')).toBeTruthy();
  let first; let second;
  act(() => { first = connection.retry(); second = connection.retry(); });
  expect(first).toBe(second);
  expect(apiClient.get).toHaveBeenCalledTimes(1);
  expect(apiClient.get).toHaveBeenCalledWith('/health');
  await act(async () => { resolve({ data: {} }); await first; });
  expect(view.getByText('reachable')).toBeTruthy();
  expect(connection.checking).toBe(false);
});

test('offline polling pauses in background and foreground resume checks with a read', async () => {
  apiClient.get.mockRejectedValue(new Error('unreachable'));
  render(<NetworkProvider><Probe /></NetworkProvider>);
  act(() => { setNetworkStatus('unreachable'); lifecycle('background'); });
  await act(async () => jest.advanceTimersByTime(45000));
  expect(apiClient.get).not.toHaveBeenCalled();
  await act(async () => lifecycle('active'));
  expect(apiClient.get).toHaveBeenCalledTimes(1);
  expect(connection.status).toBe('unreachable');
  await act(async () => jest.advanceTimersByTime(15000));
  expect(apiClient.get).toHaveBeenCalledTimes(2);
});
