export function checkedHomeStats(data) {
  const value = data?.stats;
  if (!value || value.simulated !== true || value.currency !== 'NAD' ||
    !['totalSentMinor', 'totalReceivedMinor', 'totalTransactions'].every(key => Number.isSafeInteger(value[key]) && value[key] >= 0)) {
    throw new Error('Your simulated totals are incomplete. Refresh and try again.');
  }
  return { totalSentMinor: value.totalSentMinor, totalReceivedMinor: value.totalReceivedMinor, totalTransactions: value.totalTransactions };
}
