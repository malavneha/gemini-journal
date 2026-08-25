export interface ActionPlan {
  keyInsight: string;
  practicalNextStep: string;
  smallActionToday: string;
  goalToRevisitLater: string;
  createdAt?: string;
  savedToFirestore?: boolean;
}

export interface JournalInteraction {
  id: string;
  userId: string;
  prompt: string;
  response: string;
  createdAt: string; // ISO String
  tags?: string[];
  modelUsed?: string;
  mood?: 'reflective' | 'joyful' | 'calm' | 'thoughtful' | 'seeking_clarity';
  actionPlan?: ActionPlan;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string;
}

export interface ReflectionRequest {
  prompt: string;
  history?: Array<{ role: 'user' | 'assistant' | 'model'; text: string }>;
}

export interface ReflectionResponse {
  success: boolean;
  reflection: string;
  modelUsed?: string;
  timestamp: string;
  error?: string;
}

export interface ActionPlanResponse {
  success: boolean;
  actionPlan: ActionPlan;
  modelUsed?: string;
  timestamp: string;
  error?: string;
}
