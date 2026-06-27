import "server-only";

export type AiRuntimeSettings = {
  providerName: string;
  modelName: string;
  apiKey: string;
};

export type DraftAnswerInput = {
  questionText: string;
  courseName: string;
  classDate: string | null;
  classNumber: string | null;
  moduleTopic: string | null;
  referenceLinks: string | null;
};

export type DuplicateCandidate = {
  id: string;
  questionText: string;
  localScore: number;
};

export type DuplicateRerankResult = {
  questionId: string;
  similarityScore: number;
  reason: string;
};

export class AiProviderError extends Error {
  constructor(
    public readonly publicMessage: string,
    public readonly status = 502,
  ) {
    super(publicMessage);
    this.name = "AiProviderError";
  }
}

export type AiProvider = {
  generateDraftAnswer(input: DraftAnswerInput, settings: AiRuntimeSettings): Promise<string>;
  rerankDuplicates?(
    questionText: string,
    candidates: DuplicateCandidate[],
    settings: AiRuntimeSettings,
  ): Promise<DuplicateRerankResult[]>;
};
