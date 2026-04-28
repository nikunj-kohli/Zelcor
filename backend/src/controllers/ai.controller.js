import Groq from 'groq-sdk';
import axios from 'axios';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Alternative using Hugging Face API
export async function analyzeComplaintUrgencyHF(complaintText, evidenceUrls = []) {
  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-emotion', // or a custom model for urgency
      {
        inputs: complaintText,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        },
      }
    );

    // Process the response to get urgency score
    // This is a placeholder - you'd need a model that outputs urgency
    const emotions = response.data[0];
    const urgencyMap = {
      anger: 8,
      fear: 9,
      sadness: 6,
      joy: 2,
      surprise: 5,
    };

    const maxEmotion = emotions.reduce((max, curr) => curr.score > max.score ? curr : max);
    const score = urgencyMap[maxEmotion.label] || 5;

    return {
      urgency_score: score,
      reasoning: `Based on ${maxEmotion.label} emotion with confidence ${maxEmotion.score.toFixed(2)}`,
      category: score >= 8 ? 'high' : score >= 6 ? 'medium' : 'low'
    };
  } catch (error) {
    console.error('Error with Hugging Face:', error);
    return analyzeComplaintUrgencyGroq(complaintText, evidenceUrls); // fallback
  }
}

export async function analyzeComplaintUrgency(complaintText, evidenceUrls = []) {
  // Use Groq by default, or HF if preferred
  return analyzeComplaintUrgencyGroq(complaintText, evidenceUrls);
}

async function analyzeComplaintUrgencyGroq(complaintText, evidenceUrls = []) {
  try {
    const prompt = `
Analyze the following customer complaint and determine its urgency level on a scale of 1-10 (1 being lowest urgency, 10 being highest urgency requiring immediate attention).

Complaint: ${complaintText}

${evidenceUrls.length > 0 ? `Evidence URLs: ${evidenceUrls.join(', ')}` : ''}

Consider factors like:
- Potential harm or danger
- Financial impact
- Time sensitivity
- Customer frustration level
- Legal implications

Provide a JSON response with:
- urgency_score: number (1-10)
- reasoning: brief explanation
- category: one of [low, medium, high, critical]
`;

    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-8b-8192',
      temperature: 0.3,
      max_tokens: 200,
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('Error analyzing complaint:', error);
    return {
      urgency_score: 5,
      reasoning: 'Analysis failed, defaulting to medium urgency',
      category: 'medium'
    };
  }
}