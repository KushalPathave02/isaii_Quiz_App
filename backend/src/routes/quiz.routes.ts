import express from 'express';
import { getProgressData } from '../controllers/quiz.controller';
import { protect } from '../middlewares/auth';
import fetch from 'node-fetch';
import { QuizQuestion, QuizResponse } from '../models/Quiz';
import { QuizSchema, QuizSubmissionSchema } from '../schemas/quiz';

const router = express.Router();

// Generate dynamic quiz using Ollama
router.post('/start', protect, async (req, res) => {
  try {
    const { level = "easy", count = 6, context } = req.body || {};
    let subject = req.body.subject;

    // If no subject is provided by the user, attempt to personalize based on weakest area
    if (!subject && req.user) {
      const userId = req.user._id;
      const history = await QuizResponse.find({ userId }).sort({ completedAt: -1 });

      if (history.length > 0) {
        const subjectPerformance: { [key: string]: { totalScore: number; count: number } } = {};
        history.forEach(h => {
          if (!subjectPerformance[h.subject]) {
            subjectPerformance[h.subject] = { totalScore: 0, count: 0 };
          }
          subjectPerformance[h.subject].totalScore += h.score / h.totalQuestions;
          subjectPerformance[h.subject].count++;
        });

        let weakestSubject = "";
        let lowestScore = 1.1;

        for (const sub in subjectPerformance) {
          const avgScore = subjectPerformance[sub].totalScore / subjectPerformance[sub].count;
          if (avgScore < lowestScore) {
            lowestScore = avgScore;
            weakestSubject = sub;
          }
        }

        if (weakestSubject) {
          subject = weakestSubject;
          console.log(`--- Personalizing quiz for user ${userId}. Weakest subject: ${subject} ---`);
        }
      }
    }

    // Fallback to a default subject if none is selected or found
    if (!subject) {
      subject = "Computer Science";
    }

    const prompt = `Generate a quiz with ${count} questions about ${subject} (${level} level). Respond with ONLY a valid JSON object. The JSON object must have this structure: { "subject": "${subject}", "level": "${level}", "questions": [{ "id": string, "question": string, "options": string[], "correctIndex": number, "explanation": string }] }`;

    console.log('--- Sending request to Ollama ---');
    console.log('Model:', process.env.OLLAMA_MODEL || 'gemma2:2b');
    console.log('Prompt:', prompt);
    console.log('---------------------------------');

    const r = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'gemma2:2b',
        prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.8, top_p: 0.9 }
      })
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(500).json({ ok: false, error: `Ollama error: ${text}` });
    }

    console.log('--- Received response from Ollama ---');
    const data: unknown = await r.json();

    if (typeof data !== 'object' || data === null || !('response' in data) || typeof (data as any).response !== 'string') {
      return res.status(500).json({ ok: false, error: 'Invalid response format from Ollama' });
    }

    const rawResponse = (data as { response: string }).response;

    try {
      const parsed = JSON.parse(rawResponse);

      if (parsed.questions && Array.isArray(parsed.questions)) {
        parsed.questions.forEach((q: any) => {
          if (q.id !== undefined) {
            q.id = String(q.id);
          }
        });
      }

      const validatedQuiz = QuizSchema.parse(parsed);

      res.json({ ok: true, quiz: validatedQuiz });
    } catch (parseError: any) {
      console.error('--- Failed to parse or validate quiz JSON ---');
      console.error('Zod/JSON Parse Error:', parseError.message);
      console.error('Raw Response from Ollama:', rawResponse);
      console.error('---------------------------------------------');
      res.status(500).json({ 
        ok: false, 
        error: 'Failed to process the quiz data from the AI model.',
        details: parseError.message,
        rawResponse: rawResponse 
      });
    }
  } catch (err: any) {
    console.error('--- Unhandled Quiz Generation Error ---');
    console.error(err);
    return res.status(500).json({ ok: false, error: "An unexpected error occurred during quiz generation.", detail: String(err) });
  }
});

// Submit quiz and get score
router.post('/submit', protect, async (req, res) => {
  try {
    const { quiz, answers } = req.body;
    const userId = req.user._id;
    const { questions, subject, level } = QuizSubmissionSchema.parse({ quiz, answers }).quiz;

    let score = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correctIndex) score++;
    });

    const percent = Math.round((score / questions.length) * 100);

    if (userId) {
      const quizResponse = new QuizResponse({
        userId,
        subject,
        level,
        score,
        percent,
        totalQuestions: questions.length,
        answers: questions.map((q, i) => ({
          questionId: q.id,
          selectedAnswer: answers[i],
          isCorrect: answers[i] === q.correctIndex,
        })),
        completedAt: new Date(),
      });

      await quizResponse.save();
    }

        return res.json({
      ok: true,
      score,
      percent,
      totalQuestions: questions.length,
      detailedResults: { quiz, userAnswers: answers },
    });
  } catch (e: any) {
    console.error('--- Quiz Submission Error ---');
    console.error(e);
    console.error('-----------------------------');
    return res.status(400).json({ ok: false, error: e.message });
  }
});

// Get progress dashboard data
router.get('/progress', protect, getProgressData);

// Get all quiz questions (fallback)
router.get('/questions', async (req, res) => {
  try {
    const questions = await QuizQuestion.find().select('-__v');
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching quiz questions', error });
  }
});

// Get user's quiz results
// Get the authenticated user's quiz results
router.get('/results', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const results = await QuizResponse.find({ userId }).sort({ completedAt: -1 });
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching quiz results', error });
  }
});

export default router;
