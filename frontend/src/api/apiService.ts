import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// NOTE: Replace with your actual backend IP address and port
const API_URL = 'http://192.168.1.214:5001/api'; // Replaced with the IP from Metro Bundler

const apiService = axios.create({
  baseURL: API_URL,
});

apiService.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Quiz API
export const quizAPI = {
  // Ollama-powered dynamic quiz generation
  startQuiz: (params: {
    subject?: string;
    level?: 'easy' | 'medium' | 'hard';
    count?: number;
    context?: string;
  }) => apiService.post('/quiz/start', params),
  
  // Submit quiz with Ollama-generated questions
  submitQuiz: (data: {
    quiz: any;
    answers: number[];
  }) => apiService.post('/quiz/submit', data),
  
  // Fallback methods for static questions
  getQuestions: () => apiService.get('/quiz/questions'),
  getResults: () => apiService.get('/quiz/results'),
  getProgressData: () => apiService.get('/quiz/progress'),
};

// Guidance API
export const guidanceAPI = {
  getRoadmaps: () => apiService.get('/guidance/roadmaps'),
  getRoadmapsByCategory: (category: string) => 
    apiService.get(`/guidance/roadmaps/${category}`),
  getUserProgress: (userId: string) => 
    apiService.get(`/guidance/progress/${userId}`),
  selectPath: (userId: string, selectedPath: string) => 
    apiService.post('/guidance/select-path', { userId, selectedPath }),
  completeStep: (userId: string, stepIndex: number) => 
    apiService.post('/guidance/complete-step', { userId, stepIndex })
};


// Progress API
export const progressAPI = {
  getProgressOverview: () => apiService.get('/progress/overview'), // New endpoint
  getUserProgress: (userId: string) => apiService.get(`/progress/${userId}`),
  updateProgress: (userId: string, progressData: any) => 
    apiService.put(`/progress/${userId}`, progressData),
  updateSkills: (userId: string, skills: any[]) => 
    apiService.put(`/progress/${userId}/skills`, { skills }),
  addActivity: (userId: string, activityData: any) => 
    apiService.post(`/progress/${userId}/activity`, activityData),
  getAchievements: () => apiService.get('/progress/achievements/all')
};

// Interview API
export const interviewAPI = {
  getQuestions: () => apiService.get('/interviews/questions'),
  getQuestionsByCategory: (category: string) => 
    apiService.get(`/interviews/questions/${category}`),
  getChallenges: () => apiService.get('/interviews/challenges'),
  getChallengesByDifficulty: (difficulty: string) => 
    apiService.get(`/interviews/challenges/${difficulty}`),
  startMockInterview: (userId: string, questionIds: string[], duration: number) => 
    apiService.post('/interviews/mock-interview', { userId, questionIds, duration }),
  completeMockInterview: (id: string, score: number, feedback: string) => 
    apiService.put(`/interviews/mock-interview/${id}/complete`, { score, feedback }),
  getMockInterviews: (userId: string) => 
    apiService.get(`/interviews/mock-interviews/${userId}`)
};

// Study Plan API
export const studyPlanAPI = {
  getStudyPlan: (params: { userId: string; domain: string }) =>
    apiService.get('/study-plan', { params }),
  createOrUpdateStudyPlan: (data: {
    userId: string;
    domain: string;
    topics?: any[];
    studySchedule?: any[];
    targetCompletionDate: string | Date;
  }) => apiService.post('/study-plan', data),
  updateStudySchedule: (planId: string, studySchedule: any[]) =>
    apiService.put(`/study-plan/${planId}/schedule`, { studySchedule }),
};

// Auth API
export const authAPI = {
  getProfile: () => apiService.get('/auth/profile'),
};

export default apiService;
