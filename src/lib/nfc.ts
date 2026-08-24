import { supabase } from '@/lib/supabase';

const NFC_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nfc-api`;

async function getHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function nfcFetch(path: string, options: RequestInit = {}) {
  const headers = await getHeaders();
  const res = await fetch(`${NFC_API_URL}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  return res.json();
}

export async function nfcRegister(tagUid: string, entityType: string, entityId?: string) {
  return nfcFetch('/register', { method: 'POST', body: JSON.stringify({ tagUid, entityType, entityId }) });
}

export async function nfcScan(tagUid: string, locationData?: { latitude?: number; longitude?: number; location?: string }) {
  return nfcFetch('/scan', { method: 'POST', body: JSON.stringify({ tagUid, ...locationData }) });
}

export async function nfcAssign(tagUid: string, entityType: string, entityId: string) {
  return nfcFetch('/assign', { method: 'POST', body: JSON.stringify({ tagUid, entityType, entityId }) });
}

export async function nfcUnassign(tagUid: string) {
  return nfcFetch('/unassign', { method: 'POST', body: JSON.stringify({ tagUid }) });
}

export async function nfcGenerateId(entityType: string, cropName?: string) {
  return nfcFetch('/generate-id', { method: 'POST', body: JSON.stringify({ entityType, cropName }) });
}

export async function nfcUpdateStatus(tagUid: string, status: string) {
  return nfcFetch('/status', { method: 'POST', body: JSON.stringify({ tagUid, status }) });
}

export async function nfcGetTraceability(lotId: string) {
  return nfcFetch(`/traceability/${lotId}`);
}

export async function nfcListTags() {
  return nfcFetch('/tags');
}

export async function ensureNfcIdentity(userId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('nfc_tags')
    .select('id')
    .eq('entity_type', 'FARMER')
    .eq('entity_id', userId)
    .maybeSingle();
  if (existing) return;

  const result = await nfcFetch('/generate-id', {
    method: 'POST',
    body: JSON.stringify({ entityType: 'FARMER' }),
  });
  if (!result.tagUid) return;

  await nfcFetch('/register', {
    method: 'POST',
    body: JSON.stringify({ tagUid: result.tagUid, entityType: 'FARMER', entityId: userId }),
  });
  await nfcFetch('/assign', {
    method: 'POST',
    body: JSON.stringify({ tagUid: result.tagUid, entityType: 'FARMER', entityId: userId }),
  });
}

// NFC Web API detection
export function isNfcSupported(): boolean {
  return 'NDEFReader' in window || 'NFC' in window;
}

export async function isNfcPermissionGranted(): Promise<boolean> {
  try {
    if ('permissions' in navigator) {
      const result = await (navigator as any).permissions.query({ name: 'nfc' });
      return result.state === 'granted';
    }
  } catch {
    // permissions API may not support 'nfc'
  }
  return false;
}

// NFC scanning via Web NFC API (Chrome Android only)
export async function startNfcScan(
  onDetected: (uid: string) => void,
  onError: (msg: string) => void,
): Promise<() => void> {
  try {
    const ndef = new (window as any).NDEFReader();
    const controller = new AbortController();

    await ndef.scan({ signal: controller.signal });

    ndef.addEventListener('reading', (event: any) => {
      let uid = '';
      if (event.serialNumber) {
        uid = event.serialNumber;
      }
      // Try to read text records
      if (event.message?.records) {
        for (const record of event.message.records) {
          if (record.recordType === 'text') {
            const textDecoder = new TextDecoder();
            uid = textDecoder.decode(record.data);
            break;
          }
        }
      }
      if (uid) onDetected(uid);
    });

    ndef.addEventListener('error', (err: any) => {
      onError(err.message || 'NFC scan error');
    });

    return () => controller.abort();
  } catch (err: any) {
    onError(err.message || 'Failed to start NFC scan');
    return () => {};
  }
}

// NFC writing via Web NFC API (Chrome Android only)
export async function writeNfcTag(
  text: string,
  onSuccess: () => void,
  onError: (msg: string) => void,
): Promise<void> {
  try {
    const ndef = new (window as any).NDEFReader();
    await ndef.write(text);
    onSuccess();
  } catch (err: any) {
    onError(err.message || 'Failed to write NFC tag');
  }
}

// Generate QR code data URL using a simple canvas-based approach
export function generateQrDataUrl(text: string, size = 200): string {
  // Use a public QR code API for rendering
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
}
