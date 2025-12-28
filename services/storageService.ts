
import { Expense, ContractInfo } from '../types';

const STORAGE_KEY = 'buildtrack_expenses_v1';
const CONTRACT_KEY = 'buildtrack_contract_v1';

export const storageService = {
  saveExpenses: (expenses: Expense[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  },

  getExpenses: (): Expense[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Failed to parse storage", e);
      return [];
    }
  },

  saveContract: (info: ContractInfo) => {
    localStorage.setItem(CONTRACT_KEY, JSON.stringify(info));
  },

  getContract: (): ContractInfo => {
    try {
      const data = localStorage.getItem(CONTRACT_KEY);
      // Added startDate to the default object to satisfy the ContractInfo interface
      return data ? JSON.parse(data) : { totalValue: 0, projectName: 'Main Project', startDate: new Date().toISOString().split('T')[0] };
    } catch (e) {
      // Added startDate to the default object to satisfy the ContractInfo interface
      return { totalValue: 0, projectName: 'Main Project', startDate: new Date().toISOString().split('T')[0] };
    }
  },

  exportData: (expenses: Expense[], contract: ContractInfo) => {
    const fullData = { expenses, contract, timestamp: new Date().toISOString() };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `ExpTrack_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  },

  importData: (file: File): Promise<{ expenses: Expense[], contract: ContractInfo }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (parsed.expenses && parsed.contract) {
            resolve({ expenses: parsed.expenses, contract: parsed.contract });
          } else {
            reject("Invalid backup file format.");
          }
        } catch (err) {
          reject("Failed to read backup file.");
        }
      };
      reader.readAsText(file);
    });
  }
};