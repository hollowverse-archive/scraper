import * as bluebird from 'bluebird';

type ProcessBatchOptions<Task, Result> = {
  tasks: Task[];
  concurrency: number;
  processTask(task: Task): Promise<Result>;
  onTaskCompleted(
    data: Result,
    task: Task,
    nextTask: Task | undefined,
  ): Promise<void> | void;
};

export async function processBatch<Task, Result>({
  tasks,
  concurrency,
  processTask,
  onTaskCompleted,
}: ProcessBatchOptions<Task, Result>) {
  const promises: Array<void | Promise<void>> = [];

  const results = bluebird.map(
    tasks,
    async (task, index) => {
      const result = await processTask(task);
      promises.push(onTaskCompleted(result, task, tasks[index + 1]));

      return result;
    },
    { concurrency },
  );

  await Promise.all(promises);

  return results;
}
