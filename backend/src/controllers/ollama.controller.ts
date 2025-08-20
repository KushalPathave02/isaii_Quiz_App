import { Request, Response } from 'express';
import fetch from 'node-fetch';

const OLLAMA_API_URL = 'http://127.0.0.1:11434/api/chat';
const OLLAMA_MODEL = 'gemma2:2b';

const getOllamaResponse = async (prompt: string) => {
  try {
    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        format: 'json',
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API responded with status ${response.status}`);
    }

    const data = (await response.json()) as { message: { content: string } };
    // The actual JSON content from the model is in the 'message.content' property as a string
    try {
      return JSON.parse(data.message.content);
    } catch (parseError) {
      console.error('Failed to parse JSON response from Ollama:', data.message.content);
      // Return a structured error that the frontend can handle
      return {
        feedback: 'The AI response was not in the correct format. Please try again.',
        nextQuestion: 'Could you please repeat your last answer?',
      };
    }
  } catch (error) {
    console.error('Error communicating with Ollama:', error);
    throw new Error('Failed to get response from AI model.');
  }
};

export const handleMockInterviewChat = async (req: Request, res: Response) => {
  const { history, isFinished } = req.body;

  const systemPrompt = `You are an expert AI interviewer for a software engineering role. Your goal is to conduct a mock interview. 
  1. Ask one question at a time.
  2. After the user answers, provide brief, constructive feedback (1-2 sentences).
  3. Then, ask the next logical question.
  4. If the user's answer is very short or irrelevant, gently guide them to provide more detail.
  5. Your entire response must be in a valid JSON format like this: {"feedback": "your_feedback", "nextQuestion": "your_next_question"}.`;

  const finalReportPrompt = `The interview is now finished. Based on the entire conversation history, provide a final feedback report. The report should include sections for 'strengths', 'weaknesses', 'areasForImprovement', and an 'overallScore' out of 10. Your entire response must be in a valid JSON format like this: {"finalReport": {"strengths": "...", "weaknesses": "...", "areasForImprovement": "...", "overallScore": ...}}.`;

  try {
    let prompt;
    if (isFinished) {
      prompt = `${finalReportPrompt}\n\nInterview History:\n${JSON.stringify(history, null, 2)}`;
    } else if (history.length === 0) {
      prompt = `${systemPrompt}\n\nStart the interview by asking the first question. A good first question is 'Tell me about yourself.'`;
    } else {
      prompt = `${systemPrompt}\n\nInterview History:\n${JSON.stringify(history, null, 2)}\n\nBased on the last answer, provide feedback and the next question.`;
    }

    const aiResponse = await getOllamaResponse(prompt);

    if (isFinished) {
      res.json({ finalFeedback: aiResponse.finalReport });
    } else {
      res.json(aiResponse);
    }
  } catch (error) {
    console.error('Error in handleMockInterviewChat:', error);
    res.status(500).json({ message: 'Error processing your request with the AI model.' });
  }
};
