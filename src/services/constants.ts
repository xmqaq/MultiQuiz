export const STORAGE_KEYS = {
  subjects: 'subjects',
  legacyQuestions: 'questions',
  wrongQuestions: 'wrongQuestions',
  practiceStats: 'practiceStats',
  examHistory: 'examHistory',
  practiceLog: 'practiceLog',
  questionTags: 'questionTags',
  favoriteQuestionIds: 'favoriteQuestionIds',
  browseAnswerMode: 'browseAnswerMode',
  sidebarCollapsed: 'sidebarCollapsed',
  currentExam: 'currentExam'
} as const;

export const DEFAULT_TAGS = ['重点', '易错', '已掌握', '需复习', '常考'];
