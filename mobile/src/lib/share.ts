import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { RefObject } from 'react';
import { captureRef } from 'react-native-view-shot';
import type { StatementRef } from '../components/PartyStatement';
import { api } from './api';

type Target = { ledger: string; rep?: string };

// Every copy/share is recorded on the server: it's receivables data leaving the phone.
function record(action: 'copied' | 'shared', { ledger, rep }: Target) {
  return api('/m/receivables/party/shared', {
    method: 'POST',
    body: JSON.stringify({ ledger, rep: rep || null, action }),
  }).catch(() => {});
}

/** Put the statement on the clipboard as a PNG, ready to paste into WhatsApp. */
export async function copyStatement(view: RefObject<StatementRef | null>, target: Target) {
  const base64 = await captureRef(view, { format: 'png', result: 'base64' });
  await Clipboard.setImageAsync(base64);
  await record('copied', target);
}

/** Open the share sheet (WhatsApp etc.) with the statement as a PNG. */
export async function shareStatement(view: RefObject<StatementRef | null>, target: Target) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone');
  const uri = await captureRef(view, { format: 'png', result: 'tmpfile' });
  await record('shared', target);
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: target.ledger, UTI: 'public.png' });
}
