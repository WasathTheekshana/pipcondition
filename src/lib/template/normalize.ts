/**
 * Applies Azure's "implicit stages/jobs" rule: a pipeline that only defines
 * `steps:` is implicitly one job in one stage; one that only defines `jobs:`
 * is implicitly one stage. Operates after `${{ }}`/template expansion, on
 * plain JS objects.
 * See: https://learn.microsoft.com/en-us/azure/devops/pipelines/yaml-schema/
 */
export function normalizeToStages(doc: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(doc.stages)) {
    return doc.stages as Record<string, unknown>[];
  }

  if (Array.isArray(doc.jobs)) {
    return [
      {
        stage: "__implicit",
        jobs: doc.jobs,
      },
    ];
  }

  if (Array.isArray(doc.steps)) {
    const { steps, ...jobLevelFields } = doc;
    return [
      {
        stage: "__implicit",
        jobs: [
          {
            job: "__implicit",
            steps,
            ...jobLevelFields,
          },
        ],
      },
    ];
  }

  return [];
}
