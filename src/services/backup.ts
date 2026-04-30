import type { AppStateSnapshot, BackupV2 } from '@/types';

export function exportBackup(snapshot: AppStateSnapshot): BackupV2 {
  return {
    version: '2.0',
    timestamp: new Date().toISOString(),
    exportDate: new Date().toLocaleString('zh-CN'),
    subjects: snapshot.subjects,
    wrongQuestions: snapshot.wrongQuestions,
    practiceStats: snapshot.practiceStats,
    examHistory: snapshot.examHistory,
    practiceLog: snapshot.practiceLog,
    questionTags: snapshot.questionTags,
    favoriteQuestionIds: snapshot.favoriteQuestionIds
  };
}

export async function restoreBackup(file: File): Promise<BackupV2> {
  const text = await file.text();
  const backup = JSON.parse(text) as BackupV2;
  if (backup.version !== '2.0') {
    throw new Error('备份文件格式不兼容');
  }
  return {
    ...backup,
    subjects: backup.subjects || [],
    wrongQuestions: backup.wrongQuestions || [],
    practiceStats: backup.practiceStats || { total: 0, correct: 0, practiced: 0 },
    examHistory: backup.examHistory || [],
    practiceLog: backup.practiceLog || [],
    questionTags: backup.questionTags && typeof backup.questionTags === 'object' && !Array.isArray(backup.questionTags)
      ? backup.questionTags
      : {},
    favoriteQuestionIds: Array.isArray(backup.favoriteQuestionIds)
      ? backup.favoriteQuestionIds.map(id => String(id))
      : []
  };
}
