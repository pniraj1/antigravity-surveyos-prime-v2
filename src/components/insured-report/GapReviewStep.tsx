'use client';

import { useState } from 'react';
import type { InsuredReportLineExplanation, SurveyorAnswer } from '@/types/insured-report';
import type { DeductionCategory } from '@/lib/constants/deduction-categories';

interface GapReviewStepProps {
  flaggedItems: InsuredReportLineExplanation[];
  onComplete: (answers: SurveyorAnswer[]) => void;
}

type AnswerState = {
  text: string;
  category: DeductionCategory;
  approved: boolean;
  editing: boolean;
};

export function GapReviewStep({ flaggedItems, onComplete }: GapReviewStepProps) {
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() =>
    Object.fromEntries(
      flaggedItems.map(item => [
        item.assessmentRowId,
        { text: item.aiExplanation, category: item.deductionCategory, approved: false, editing: false },
      ]),
    ),
  );

  const allApproved = Object.values(answers).every(a => a.approved);

  function approve(id: string) {
    setAnswers(prev => ({ ...prev, [id]: { ...prev[id], approved: true, editing: false } }));
  }

  function startEdit(id: string) {
    setAnswers(prev => ({ ...prev, [id]: { ...prev[id], editing: true, approved: false } }));
  }

  function saveEdit(id: string, text: string) {
    setAnswers(prev => ({ ...prev, [id]: { ...prev[id], text, editing: false, approved: true } }));
  }

  function approveAll() {
    setAnswers(prev =>
      Object.fromEntries(Object.entries(prev).map(([id, a]) => [id, { ...a, approved: true, editing: false }])),
    );
  }

  function handleContinue() {
    const result: SurveyorAnswer[] = flaggedItems.map(item => ({
      assessmentRowId: item.assessmentRowId,
      approvedExplanation: answers[item.assessmentRowId].text,
      deductionCategory: answers[item.assessmentRowId].category,
      surveyorEdited: answers[item.assessmentRowId].text !== item.aiExplanation,
    }));
    onComplete(result);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">
          {flaggedItems.length} item{flaggedItems.length !== 1 ? 's' : ''} need your review before the
          report can be generated. The AI has drafted explanations — approve or correct each one.
        </p>
      </div>

      {flaggedItems.map(item => {
        const ans = answers[item.assessmentRowId];
        return (
          <div key={item.assessmentRowId} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <span className="font-medium text-sm">{item.partDescription}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                ₹{item.billedAmount.toLocaleString('en-IN')} billed →{' '}
                ₹{item.surveyorAmount.toLocaleString('en-IN')} assessed
              </span>
            </div>

            <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 border">
              {ans.category}
            </span>

            {ans.editing ? (
              <EditableExplanation initial={ans.text} onSave={text => saveEdit(item.assessmentRowId, text)} />
            ) : (
              <p className="text-sm text-muted-foreground italic">&ldquo;{ans.text}&rdquo;</p>
            )}

            {ans.approved ? (
              <span className="text-xs text-green-600 font-medium">✓ Approved</span>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(item.assessmentRowId)}
                  className="text-xs px-3 py-1 rounded border hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => approve(item.assessmentRowId)}
                  className="text-xs px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                >
                  ✓ Approve
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={approveAll}
          className="text-sm px-4 py-2 rounded border hover:bg-gray-50"
        >
          Approve All
        </button>
        <button
          type="button"
          disabled={!allApproved}
          onClick={handleContinue}
          className="text-sm px-4 py-2 rounded bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function EditableExplanation({ initial, onSave }: { initial: string; onSave: (text: string) => void }) {
  const [text, setText] = useState(initial);
  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        className="w-full rounded border p-2 text-sm resize-none"
      />
      <button
        type="button"
        onClick={() => onSave(text)}
        className="text-xs px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
      >
        Save & Approve
      </button>
    </div>
  );
}
