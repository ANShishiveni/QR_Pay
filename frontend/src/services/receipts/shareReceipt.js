import { Share } from 'react-native';
import { receiptText } from './receiptExport';
export async function shareReceipt(transaction) {
  const message = receiptText(transaction);
  try {
    const result = await Share.share({ title: 'NamPay simulated receipt', message });
    return { action: result.action === Share.dismissedAction ? 'cancelled' : 'shared' };
  } catch { throw new Error('The receipt could not be shared. You can still view it here.'); }
}
