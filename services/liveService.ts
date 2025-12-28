
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { ExpenseCategory, PaymentType } from '../types';

export const addExpenseFunctionDeclaration: FunctionDeclaration = {
  name: 'addExpense',
  parameters: {
    type: Type.OBJECT,
    description: 'Add a new construction expense to the tracker.',
    properties: {
      amount: {
        type: Type.NUMBER,
        description: 'The numeric amount of the expense in Rupees.',
      },
      category: {
        type: Type.STRING,
        description: 'The category of the expense.',
        enum: Object.values(ExpenseCategory),
      },
      payee: {
        type: Type.STRING,
        description: 'Who was paid or the vendor name.',
      },
      type: {
        type: Type.STRING,
        description: 'The status of the payment.',
        enum: Object.values(PaymentType),
      },
      notes: {
        type: Type.STRING,
        description: 'Any additional details about the work or materials.',
      },
      date: {
        type: Type.STRING,
        description: 'The date of the expense in YYYY-MM-DD format. Defaults to today if not mentioned.',
      },
    },
    required: ['amount', 'category', 'payee', 'type'],
  },
};

export function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
