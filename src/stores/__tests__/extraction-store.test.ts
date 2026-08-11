import { describe, it, expect, beforeEach } from 'vitest';
import {
  useExtractionStore,
  registerAbort,
  getAbort,
  selectIsProcessing,
  selectLatestReview,
} from '../extraction-store';

// File is a DOM type and the runner is a node environment; nothing under test
// touches the file's contents, only its identity.
const fakeFile = {} as File;

function reset() {
  useExtractionStore.setState({ jobs: {}, files: {}, discrepancies: {} });
}

const s = () => useExtractionStore.getState();

describe('extraction store', () => {
  beforeEach(reset);

  it('carries a job from start through progress to a finished result', () => {
    s().startJob('rc', 'documents');
    s().setProgress('rc', 'Reading page 2…', 2, 4);
    s().finishJob('rc', { key: 'rc', data: { registration_number: 'MH12AB1234' }, file: fakeFile });

    const job = s().jobs.rc;
    expect(job.status).toBe('done');
    expect(job.pagesDone).toBe(2);
    expect(job.pagesTotal).toBe(4);
    expect(job.result?.data).toEqual({ registration_number: 'MH12AB1234' });
    expect(selectLatestReview(s())).toEqual(job.result);
  });

  it('leaves no residual data when a job is cancelled', () => {
    s().startJob('rc', 'documents');
    s().setProgress('rc', 'Reading page 2…', 2, 4);
    s().setDiscrepancyContext('rc', { totalPages: 4, discrepancies: ['Parts mismatch'] });

    s().cancelJob('rc');

    expect(s().jobs.rc).toBeUndefined();
    expect(s().discrepancies.rc).toBeUndefined();
    expect(selectIsProcessing(s())).toBe(false);
    expect(selectLatestReview(s())).toBeNull();
  });

  it('aborts the registered controller on cancel', () => {
    const controller = new AbortController();
    s().startJob('estimate', 'assessment');
    registerAbort('estimate', controller);

    s().cancelJob('estimate');

    expect(controller.signal.aborted).toBe(true);
    expect(getAbort('estimate')).toBeUndefined();
  });

  // The safety property the whole cancel design rests on. The fetch is not
  // synchronously killed, so a cancelled job's promise can still resolve
  // afterwards. If that late result were written, a surveyor who cancelled
  // would silently receive data from a half-read document.
  it('discards a result that arrives after cancellation', () => {
    s().startJob('estimate', 'assessment');
    s().cancelJob('estimate');

    s().setProgress('estimate', 'Reading page 4…', 4, 5);
    s().finishJob('estimate', { key: 'estimate', data: { gross_amount: 999 }, file: fakeFile });

    expect(s().jobs.estimate).toBeUndefined();
    expect(selectLatestReview(s())).toBeNull();
  });

  it('keeps concurrent jobs independent', () => {
    s().startJob('rc', 'documents');
    s().startJob('estimate', 'assessment');
    s().setProgress('rc', 'Reading RC…', 1, 2);
    s().setProgress('estimate', 'Reading estimate…', 3, 6);

    s().cancelJob('rc');

    expect(s().jobs.rc).toBeUndefined();
    expect(s().jobs.estimate?.status).toBe('processing');
    expect(s().jobs.estimate?.pagesDone).toBe(3);
    expect(selectIsProcessing(s())).toBe(true);
  });

  it('records a failure without losing the message', () => {
    s().startJob('dl', 'documents');
    s().failJob('dl', 'Rate limit exceeded');

    expect(s().jobs.dl.status).toBe('error');
    expect(s().jobs.dl.error).toBe('Rate limit exceeded');
    expect(s().jobs.dl.result).toBeNull();
    expect(selectIsProcessing(s())).toBe(false);
  });

  it('surfaces the most recently started finished job for review', () => {
    s().startJob('rc', 'documents');
    s().finishJob('rc', { key: 'rc', data: { a: 1 }, file: fakeFile });

    // startedAt comes from Date.now(); force a later start so ordering is
    // deterministic rather than dependent on clock resolution.
    s().startJob('dl', 'documents');
    useExtractionStore.setState((state) => ({
      jobs: { ...state.jobs, dl: { ...state.jobs.dl, startedAt: state.jobs.rc.startedAt + 1000 } },
    }));
    s().finishJob('dl', { key: 'dl', data: { b: 2 }, file: fakeFile });

    expect(selectLatestReview(s())?.key).toBe('dl');

    s().clearJob('dl');
    expect(selectLatestReview(s())?.key).toBe('rc');
  });

  it('remembers files so re-scan survives a tab switch', () => {
    s().rememberFile('rc', fakeFile);
    expect(s().files.rc).toBe(fakeFile);

    // Cancelling a job must not discard the file — the surveyor may re-scan.
    s().startJob('rc', 'documents');
    s().cancelJob('rc');
    expect(s().files.rc).toBe(fakeFile);
  });
});
