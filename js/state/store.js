// =============================================
// 数据模型
// subjects: [{ id, name, questions: [...] }]
// wrongQuestions: [{ ...question, subjectId, subjectName, userAnswer, timestamp }]
// practiceStats: { total, correct, practiced }
// examHistory: [{ id, date, score, ... subjectId, subjectName }]
// practiceLog: [{ id, sessionId, date, subjectId, subjectName, totalQuestions, correct, mode, sourceExamRecordId }]
// =============================================

let subjects = [];
let wrongQuestions = [];
let practiceStats = { total: 0, correct: 0, practiced: 0 };
let examHistory = [];
let practiceLog = [];
let currentExam = {};
let currentChartPeriod = '7';
let modalCallbacks = {}; // 用于存储模态框回调
let questionTags = {}; // 题目标签: { questionId: ['tag1', 'tag2'] }
let availableTags = ['重点', '易错', '已掌握', '需复习', '常考']; // 预设标签
let favoriteQuestionIds = [];
let favoriteSet = new Set();
let mobileBrowseFiltersExpanded = false;
let browseAnswerMode = 'show';
let revealedBrowseAnswers = new Set();
let currentTab = 'subjects';
