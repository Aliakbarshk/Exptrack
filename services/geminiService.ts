
import { GoogleGenAI, Type } from "@google/genai";
import { Expense, ExpenseCategory, PaymentType } from '../types';

const getClient = () => {
  const customKey = localStorage.getItem('exptrack_custom_api_key');
  const apiKey = customKey || process.env.API_KEY;
  return new GoogleGenAI({ apiKey: apiKey as string });
};

export const getAIInsights = async (expenses: Expense[]): Promise<string> => {
  const ai = getClient();
  
  const summaryText = expenses.map(e => 
    `- ${e.date}: ${e.amount} spent on ${e.category} (${e.type}) to ${e.payee}. Notes: ${e.notes}`
  ).join('\n');

  const prompt = `
    Analyze these home construction expenses and provide a concise, helpful summary in Hinglish.
    Identify patterns and suggest savings.
    
    Expenses Log:
    ${summaryText}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No insights available.";
  } catch (error) {
    return "Failed to load insights. Check your API key.";
  }
};

export const parseBulkExpenses = async (text: string): Promise<Partial<Expense>[]> => {
  const ai = getClient();
  const today = new Date().toISOString().split('T')[0];

  const prompt = `Extract construction expenses from text and return JSON array.
  Text: "${text}"
  Use categories: ${Object.values(ExpenseCategory).join(', ')}
  Payment types: ${Object.values(PaymentType).join(', ')}
  Today: ${today}.
  Return ONLY JSON array.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER },
              category: { type: Type.STRING },
              payee: { type: Type.STRING },
              type: { type: Type.STRING },
              notes: { type: Type.STRING },
              date: { type: Type.STRING }
            },
            required: ["amount", "payee", "category", "type", "date"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Parsing Error:", error);
    throw new Error("Could not parse text.");
  }
};
