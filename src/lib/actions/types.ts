export type ActionState<T = unknown> = {
  success: boolean;
  error?: string | null;
  data?: T;
};

