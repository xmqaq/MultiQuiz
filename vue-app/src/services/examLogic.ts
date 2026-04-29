import type { Question, QuestionTags, WrongQuestion } from '@/types';
import { questionIdKey, shuffleArray } from './utils';

export function smartSelectQuestions(
  pool: Question[],
  count: number,
  options: { wrongFirst: boolean; weighted: boolean; tagged: boolean },
  wrongQuestions: WrongQuestion[],
  questionTags: QuestionTags
): Question[] {
  const wrongIdSet = new Set<string>();
  const wrongCountMap = new Map<string, number>();

  if (options.wrongFirst || options.weighted) {
    wrongQuestions.forEach(wrong => {
      const key = questionIdKey(wrong.id);
      wrongIdSet.add(key);
      if (options.weighted) {
        wrongCountMap.set(key, (wrongCountMap.get(key) || 0) + 1);
      }
    });
  }

  const weightedPool = pool.map(question => {
    const key = questionIdKey(question.id);
    let weight = 1;
    if (options.wrongFirst && wrongIdSet.has(key)) weight += 5;
    if (options.tagged && questionTags[key]?.includes('需复习')) weight += 3;
    if (options.weighted) weight += (wrongCountMap.get(key) || 0) * 2;
    return { ...question, weight };
  });

  const selected: Question[] = [];
  const remaining = [...weightedPool].sort((a, b) => (b.weight || 1) - (a.weight || 1));
  const targetCount = Math.min(count, pool.length);

  while (selected.length < targetCount && remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, question) => sum + (question.weight || 1), 0);
    let random = Math.random() * totalWeight;
    let selectedIndex = 0;
    for (let i = 0; i < remaining.length; i += 1) {
      random -= remaining[i].weight || 1;
      if (random <= 0) {
        selectedIndex = i;
        break;
      }
    }
    selected.push(remaining[selectedIndex]);
    remaining.splice(selectedIndex, 1);
  }

  return shuffleArray(selected);
}
