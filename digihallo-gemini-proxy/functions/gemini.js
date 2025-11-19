// functions/gemini.js
// Netlify function handler
import fetch from 'node-fetch'; // required if your runtime doesn't have global fetch

export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const userMessage = (payload.message || '').toString().trim();
    const history = Array.isArray(payload.history) ? payload.history : [];

    if (!userMessage) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No message provided' }) };
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if(!API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured: missing GEMINI_API_KEY' }) };
    }

    // --- System prompt (customized for DigiHallo) ---
    const systemInstruction = `
You are DigiHallo Assistant, an expert and concise AI that answers ONLY questions about content, products, tools, and policies on https://digihallo.blogspot.com/.
Cite page names or paths when using site-specific info. If the user asks outside site scope, reply: "I can only answer DigiHallo related questions."
Keep answers clear and short unless a step-by-step is requested.
    `.trim();

    // Build a short textual prompt including a bit of history.
    const historyText = history.slice(-6).map(h => {
      const who = (h.sender === 'user') ? 'User' : 'Assistant';
      return `${who}: ${h.text}`;
    }).join('\n');

    const finalPrompt = [
      `System: ${systemInstruction}`,
      historyText ? `Conversation history:\n${historyText}` : '',
      `User: ${userMessage}`
    ].filter(Boolean).join('\n\n');

    // Google Generative Language REST endpoint (adjust version if needed)
    const url = `https://generativelanguage.googleapis.com/v1beta2/models/gemini-pro:generateText?key=${API_KEY}`;

    const body = {
      // depending on exact API version you have, payload shape might differ.
      // This is a generic text-generation request — adjust if your account uses chat endpoint.
      prompt: finalPrompt,
      maxOutputTokens: 500,
      temperature: 0.2,
      topP: 0.9
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });

    const data = await resp.json();

    // Try to extract reply text depending on response shape
    let reply = '';
    if (data?.candidates?.[0]?.output) {
      reply = data.candidates[0].output;
    } else if (data?.output?.[0]?.content) {
      // sometimes different shapes
      reply = data.output[0].content.map(c => c.text || c).join(' ');
    } else if (data?.candidates?.[0]?.content) {
      reply = data.candidates[0].content.map(c => c.text || c).join(' ');
    } else {
      reply = JSON.stringify(data);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
}
