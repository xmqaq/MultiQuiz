import type { Question } from '@/types';
import { validateImportQuestions } from './validators';

export async function parseJson(file: File): Promise<Question[]> {
  const text = await file.text();
  const config = JSON.parse(text);
  const rawQuestions = Array.isArray(config) ? config : config?.questions || [];
  return validateImportQuestions(rawQuestions);
}

export async function parseExcel(file: File): Promise<Question[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Excel 文件中没有工作表');
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`找不到工作表: ${sheetName}`);
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  return parseExcelRows(rows);
}

export function parseExcelRows(rows: any[][]): Question[] {
  const raw = rows.slice(1).map(row => ({
    question: row?.[0],
    optionA: row?.[1],
    optionB: row?.[2],
    optionC: row?.[3],
    optionD: row?.[4],
    answer: row?.[5]
  }));
  return validateImportQuestions(raw);
}

export async function parseQuestionFile(file: File): Promise<Question[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) return parseJson(file);
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseExcel(file);
  throw new Error('请选择 Excel (.xlsx/.xls) 或 JSON 文件');
}
